import json
import uuid
import logging # Added for more structured logging, can be replaced with print if preferred
from typing import Dict, List, Any, Optional
from tavily import TavilyClient

# LangGraph imports
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, END, START
from langgraph.types import Command
from langgraph.checkpoint.memory import MemorySaver
import asyncio
# CopilotKit imports
from copilotkit import CopilotKitState
from copilotkit.langgraph import (
    copilotkit_customize_config,
    copilotkit_emit_state,
    copilotkit_emit_message
)
from copilotkit.langgraph import (copilotkit_exit)
# OpenAI imports
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage, AIMessage

from dotenv import load_dotenv
load_dotenv() 


class AgentState(CopilotKitState):
    """
    The state of the agent.
    """
    haiku: Optional[str] = None
    tavily_response: Optional[List[Dict[str, Any]]] = None
    haiku_args: Optional[Dict[str, Any]] = None
    tavily_responses_content: Optional[str] = None
    haiku_verification: Optional[Dict[str, Any]] = None

async def start_flow(state: AgentState, config: RunnableConfig):
    """
    This is the entry point for the flow.
    Analyzes the user message to determine if we should continue with haiku creation.
    """
    print("\n--- Entering start_flow ---")
    print(f"Initial state: {state}")
    
    # Reset any previous state that might cause issues
    state["haiku_verification"] = None
    state["tavily_responses_content"] = None
    state["haiku_args"] = None
    
    # We'll let the conditional routing determine the next node
    print("Checking if we should continue with haiku creation or end...")
    print("--- Exiting start_flow ---")
    
    return state


async def search_node(state: AgentState, config: RunnableConfig):
    """
    Node to perform Tavily search based on user input.
    """
    print("\n--- Entering search_node ---")
    print(f"Current state: {state}")
    
    model = ChatOpenAI(model="gpt-4o")

    # Define tool for getting topics
    GET_TOPICS_TOOL = {
        "type": "function",
        "function": {
            "name": "get_topics",
            "description": "Get topics to search for haiku creation",
            "parameters": {
                "type": "object",
                "properties": {
                    "topics": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        },
                        "description": "List of topics to search for (exact 3 topics)"
                    }
                },
                "required": ["topics"]
            }
        }
    }
    
    system_prompt = """
    You are a helpful assistant who identifies topics for haiku creation.
    If the user asks for a haiku on a specific topic, use the get_topics tool to provide related search topics.
    For example, if the user asks for a haiku on 'Politics', use the tool to return ['Politics', 'Donald Trump', 'Current elections'].
    Return EXACTLY 3 topics that are closely related to create a meaningful haiku.
    If the user has already received a haiku and is commenting on it, just respond normally without using the tool.
    """

    # Bind the tool to the model
    model_with_tools = model.bind_tools(
        [GET_TOPICS_TOOL],
        parallel_tool_calls=False,
    )
    
    print("Invoking model to identify topics using tool...")
    response = await model_with_tools.ainvoke([
        SystemMessage(content=system_prompt),
        *state["messages"],
    ], config)
    
    # Add the response to messages
    messages = state["messages"] + [response]
    state["messages"] = messages
    
    # Check if the model used the tool
    if hasattr(response, "tool_calls") and response.tool_calls:
        tool_call = response.tool_calls[0]
        
        if isinstance(tool_call, dict):
            tool_call_id = tool_call["id"]
            tool_call_name = tool_call["name"]
            tool_call_args = tool_call["args"]
        else:
            tool_call_id = tool_call.id
            tool_call_name = tool_call.name
            tool_call_args = tool_call.args
            
        print(f"Tool call details - ID: {tool_call_id}, Name: {tool_call_name}, Args: {tool_call_args}")
        
        if tool_call_name == "get_topics":
            # Extract topics from tool call
            topics = tool_call_args.get("topics", [])
            if not topics:
                print("No topics returned by the tool, ending flow")
                # No need to navigate to END, conditional routing will handle it
                await copilotkit_exit(config)
                return {"messages": state["messages"]}
                
            print(f"Extracted topics from tool call: {topics}")
            
            # Add tool response
            tool_response = {
                "role": "tool",
                "content": f"Topics identified: {', '.join(topics)}",
                "tool_call_id": tool_call_id
            }
            messages = messages + [tool_response]
            state["messages"] = messages
            
            # Prepare topics for Tavily search
            mapped_topics = list(map(lambda x: {
                'topic': x,
                'completed': False,
            }, topics))
            state['tavily_response'] = mapped_topics
            print(f"Updated state with initial tavily_response: {state['tavily_response']}")
            await copilotkit_emit_state(config, state)
            
            tavily_responses = []
            # Perform Tavily searches
            for item in state['tavily_response']:
                topic_to_search = item['topic']
                print(f"Searching Tavily for topic: '{topic_to_search}'")
                if not isinstance(topic_to_search, str):
                    print(f"Warning: Topic '{topic_to_search}' is not a string, converting.")
                    topic_to_search = str(topic_to_search)

                tavily_client = TavilyClient()
                try:
                    tavily_response_data = tavily_client.search(topic_to_search,'basic','news','week',7,3)
                    print(f"Tavily response for '{topic_to_search}': {json.dumps(tavily_response_data, indent=2)}")
                    if tavily_response_data and tavily_response_data.get('results') and len(tavily_response_data['results']) > 0:
                        content = tavily_response_data['results'][0]['content']
                        tavily_responses.append(content)
                        print(f"Added content for '{topic_to_search}': '{content[:100]}...'") # Log snippet
                    else:
                        print(f"No content found or unexpected format for '{topic_to_search}'. Response: {tavily_response_data}")
                        tavily_responses.append(f"No content found for {topic_to_search}")
                except Exception as e:
                    print(f"Error during Tavily search for topic '{topic_to_search}': {e}")
                    tavily_responses.append(f"Error searching for {topic_to_search}")
                
                item['completed'] = True
                await copilotkit_emit_state(config, state)
                print(f"Updated item to completed: {item}")
            
            state['tavily_responses_content'] = " ".join(tavily_responses)
            print(f"Concatenated Tavily responses content: '{state['tavily_responses_content'][:200]}...'") # Log snippet
            
            print("--- Exiting search_node with content for next node ---")
            # await copilotkit_emit_message(config, "Tavily search completed")
            # state["messages"] = state["messages"] + [AIMessage(content="Tavily search completed")]
            # await copilotkit_emit_state(config, state)
            state['tavily_response'] = None
            return Command(
                goto="haiku_generation_node",
                update=state
            )
        else:
            print(f"Unexpected tool call: {tool_call_name}, ending flow via conditional routing")
    else:
        print("Model responded with text instead of using the get_topics tool, ending flow via conditional routing")
    
    # For all non-success paths, let conditional routing handle the transition
    await copilotkit_exit(config)
    return Command(
                goto=END,
                update=state
            )

async def haiku_generation_node(state: AgentState, config: RunnableConfig):
    """
    Node to generate Haiku and confirm it.
    """
    print("\n--- Entering haiku_generation_node ---")
    print(f"Current state: {state}")

    
    model = ChatOpenAI(model="gpt-4o")
    tavily_responses_content = state.get('tavily_responses_content', "")
    print(f"Received tavily_responses_content: '{tavily_responses_content[:200]}...'") # Log snippet

    GENERATE_HAIKU_TOOL = {
        "type": "function",
        "function": {
            "name": "generate_haiku",
            "description": f"""
            Generate a haiku poem based on the user's request. The user's request is {state["messages"][-1].content}. Make sure to generate the haiku strictly based on the content provided here : {tavily_responses_content}
            """,
            "parameters": {
                "type": "object",
                "properties": {
                    "japanese": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        },
                        "description": "An array of three lines of the haiku in Japanese"
                    },
                    "english": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        },
                        "description": "An array of three lines of the haiku in English"
                    }
                },
                "required": ["japanese", "english"]
            }
        }
    }
    print(f"Defined GENERATE_HAIKU_TOOL for user message: {state["messages"][-1].content}")

    system_prompt = """
    You are a helpful assistant for generating Haiku poems. 
    To generate the poem, you MUST use the generate_haiku tool.
    """
    
    if config is None:
        print("Config is None, initializing RunnableConfig.")
        config = RunnableConfig(recursion_limit=25)

    model_with_tools = model.bind_tools(
        [
            *state["copilotkit"]["actions"],
            GENERATE_HAIKU_TOOL
        ],
        parallel_tool_calls=False,
    )
    print("Model bound with tools including generate_haiku and copilotkit actions.")

    print("Invoking model_with_tools for haiku generation...")
    response = await model_with_tools.ainvoke([
        SystemMessage(content=system_prompt),
        *state["messages"],
    ], config)
    print(f"LLM response for haiku generation: {response}")



    messages = state["messages"] + [response]
    
    if hasattr(response, "tool_calls") and response.tool_calls:
        tool_call = response.tool_calls[0]
        print(f"Detected tool call: {tool_call}")
        
        if isinstance(tool_call, dict):
            tool_call_id = tool_call["id"]
            tool_call_name = tool_call["name"]
            tool_call_args = tool_call["args"]
        else:
            tool_call_id = tool_call.id
            tool_call_name = tool_call.name
            tool_call_args = tool_call.args
        print(f"Tool call details - ID: {tool_call_id}, Name: {tool_call_name}, Args: {tool_call_args}")

        if tool_call_name == "generate_haiku":
            print(f"Tool call is '{tool_call_name}'. Preparing tool response and starting haiku verification.")
            tool_response = {
                "role": "tool",
                "content": "Haiku generated.",
                "tool_call_id": tool_call_id
            }
            
            # Add verification steps that will be updated in the UI
            verification_steps = [
                {"task": "Verifying the Haiku with the 🥷 Haiku Master", "completed": False},
            ]
            
            # Setup verification state for UI display
            state['haiku_verification'] = {
                "steps": verification_steps,
                "japanese": tool_call_args.get("japanese", []),
                "english": tool_call_args.get("english", [])
            }
            
            # Save the haiku args for later use in rendering
            state['haiku_args'] = {
                "japanese": tool_call_args.get("japanese", []),
                "english": tool_call_args.get("english", [])
            }
            
            # Add tool response to messages
            messages = messages + [tool_response]
            state["messages"] = messages
            
            # Emit the initial state to show the verification starting
            await copilotkit_emit_state(config, state)
            print(f"Emitted initial verification state: {state['haiku_verification']}")
            
            # Simulate verification process by updating steps one by one
            verification_steps = state['haiku_verification']["steps"]
            for i, step in enumerate(verification_steps):
                # Wait for a short time to simulate processing
                await asyncio.sleep(2.5)
                # Mark step as completed
                verification_steps[i]["completed"] = True
                # Update state
                state['haiku_verification']["steps"] = verification_steps
                # Emit updated state
                await copilotkit_emit_state(config, state)
                print(f"Updated verification step {i+1}: {step['task']} to completed")
            
            # Wait a moment after all steps are completed
            await asyncio.sleep(0.5)
            
            # Clear the verification state after all steps are completed
            state['haiku_verification'] = None
            await copilotkit_emit_state(config, state)
            print("Cleared verification state and proceeding to render")
            
            target_node = "render_haiku_node"
            print(f"Transitioning to {target_node}")
            print("--- Exiting haiku_generation_node (after generate_haiku) ---")
            messages = state["messages"] +[AIMessage(content="Here is the final Haiku")]
            state["messages"] = messages
            return Command(
                goto=target_node,
                update=state
            )
        else:
            print(f"Tool call was '{tool_call_name}', not 'generate_haiku'. Not processing further in this branch.")
    
    print("No 'generate_haiku' tool call detected or an issue occurred. Transitioning to END.")
    await copilotkit_exit(config)
    state["messages"] = messages # Ensure messages are updated even if going to END
    print("--- Exiting haiku_generation_node (going to END) ---")
    return Command(
        goto=END,
        update=state
    )

async def render_haiku_node(state: AgentState, config: RunnableConfig):
    """
    Node to render the Haiku and allow user interaction.
    """
    print("\n--- Entering render_haiku_node ---")
    print(f"Current state: {state}")

    haiku_args = state.get('haiku_args')
    print(f"Received haiku_args for rendering: {haiku_args}")

    if not haiku_args:
        print("Error: Haiku arguments (haiku_args) not found in state for rendering. Exiting.")
        await copilotkit_exit(config)
        print("--- Exiting render_haiku_node (due to missing haiku_args) ---")
        return Command(goto=END, update=state)

    if config is None:
        print("Config is None, initializing RunnableConfig.")
        config = RunnableConfig(recursion_limit=25)
    
    # The haiku_args should already contain only japanese and english arrays
    render_haiku_tool_arguments_str = ""
    try:
        render_haiku_tool_arguments_str = json.dumps(haiku_args)
        print(f"Serialized render args to JSON: {render_haiku_tool_arguments_str}")
    except TypeError as e:
        print(f"Error: Could not serialize render_args to JSON: {e}. Args: {haiku_args}")
        render_haiku_tool_arguments_str = str(haiku_args)

    render_haiku_tool_call_message = {
        "role": "assistant",
        "content": "", 
        "tool_calls": [{
            "id": str(uuid.uuid4()), 
            "type": "function", 
            "function": {
                "name": "render_haiku",
                "arguments": render_haiku_tool_arguments_str 
            }
        }]
    }
    print(f"Constructed render_haiku_tool_call_message: {json.dumps(render_haiku_tool_call_message, indent=2)}")

    messages = state["messages"] + [render_haiku_tool_call_message]
    state["messages"] = messages
    print(f"Updated messages in state with render_haiku_tool_call.")
    
    # No waiting for response - just proceed to exit as in the example
    await copilotkit_exit(config)
    print("--- Exiting render_haiku_node (transitioning to END) ---")
    return Command(
        goto=END,
        update=state
    )

# Define the graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("start_flow", start_flow)
workflow.add_node("search_node", search_node)
workflow.add_node("haiku_generation_node", haiku_generation_node)
workflow.add_node("render_haiku_node", render_haiku_node)

# Define conditional routing
def should_continue_from_start(state):
    # Add logic to check if we should continue based on state
    # For example, if the user is just saying thanks for a previous haiku
    # For now, always continue to search
    if state.get("messages") and len(state["messages"]) > 0:
        last_msg = state["messages"][-1]
        content = getattr(last_msg, "content", "") or ""
        # Check if message contains words that suggest thanks or acknowledgment
        if any(word in content.lower() for word in ["thank", "thanks", "appreciated", "great haiku", "nice haiku", "love the haiku"]):
            print("Detected thank you message, ending flow")
            return "end"
    return "search_node"

def should_continue_from_search(state):
    # Check if Tavily searches were performed
    if state.get("tavily_responses_content"):
        return "haiku_generation_node"
    # If no search results, end the flow
    return "end"

# Add regular edges
workflow.set_entry_point("start_flow")
workflow.add_edge(START, "start_flow")

# Add conditional edges
workflow.add_conditional_edges(
    "start_flow",
    should_continue_from_start,
    {
        "search_node": "search_node",
        "end": END
    }
)

workflow.add_conditional_edges(
    "search_node",
    should_continue_from_search,
    {
        "haiku_generation_node": "haiku_generation_node",
        "end": END
    }
)

workflow.add_edge("haiku_generation_node", "render_haiku_node")
workflow.add_edge("render_haiku_node", END)

# Compile the graph
ag_ui_graph = workflow.compile(checkpointer=MemorySaver())
