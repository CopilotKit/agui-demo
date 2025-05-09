import json
import uuid
from typing import Dict, List, Any, Optional

# LangGraph imports
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, END, START
from langgraph.types import Command
from langgraph.checkpoint.memory import MemorySaver

# CopilotKit imports
from copilotkit import CopilotKitState
from copilotkit.langgraph import (
    copilotkit_customize_config
)
from copilotkit.langgraph import (copilotkit_exit)
# OpenAI imports
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

from dotenv import load_dotenv
load_dotenv() 


class AgentState(CopilotKitState):
    """
    The state of the agent.
    """
    haiku: Optional[str] = None


async def start_flow(state: AgentState, config: RunnableConfig):
    """
    This is the entry point for the flow.
    """
    return Command(
        goto="chat_node"
    )


async def chat_node(state: AgentState, config: RunnableConfig):
    """
    Standard chat node.
    """
    
    GENERATE_HAIKU_TOOL = {
    "type": "function",
    "function": {
        "name": "generate_haiku",
        "description": f"""
        Generate a haiku poem based on the user's request. The user's request is {state["messages"][-1].content}.
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

    system_prompt = """
    You are a helpful assistant for generating Haiku poems. 
    To generate the poem, you MUST use the generate_haiku tool.
    Once the haiku is generated, you MUST use the confirm_changes tool to confirm the changes.
    Once the changes are confirmed, you MUST use the render_haiku tool to render the haiku.
    """

    # Define the model
    model = ChatOpenAI(model="gpt-4o")
    
    # Define config for the model with emit_intermediate_state to stream tool calls to frontend
    if config is None:
        config = RunnableConfig(recursion_limit=25)
    
    # Use CopilotKit's custom config to set up streaming for the write_document tool
    # This is equivalent to copilotkit_predict_state in the CrewAI version
    config = copilotkit_customize_config(
        config,
        emit_intermediate_state=[{
            "state_key": "haiku",
            "tool": "generate_haiku",
            "tool_argument": "haiku",
        }],
    )

    # Bind the tools to the model
    model_with_tools = model.bind_tools(
        [
            *state["copilotkit"]["actions"],
            GENERATE_HAIKU_TOOL
        ],
        # Disable parallel tool calls to avoid race conditions
        parallel_tool_calls=False,
    )

    # Run the model to generate a response
    response = await model_with_tools.ainvoke([
        SystemMessage(content=system_prompt),
        *state["messages"],
    ], config)

    # Update messages with the response
    messages = state["messages"] + [response]
    
    # Extract any tool calls from the response
    if hasattr(response, "tool_calls") and response.tool_calls:
        tool_call = response.tool_calls[0]
        
        # Handle tool_call as a dictionary or an object
        if isinstance(tool_call, dict):
            tool_call_id = tool_call["id"]
            tool_call_name = tool_call["name"]
            tool_call_args = tool_call["args"]
        else:
            # Handle as an object (backward compatibility)
            tool_call_id = tool_call.id
            tool_call_name = tool_call.name
            tool_call_args = tool_call.args

        if tool_call_name == "generate_haiku":
            # Add the tool response to messages
            tool_response = {
                "role": "tool",
                "content": "Haiku generated.",
                "tool_call_id": tool_call_id
            }
            
            # Add confirmation tool call
            confirm_tool_call = {
                "role": "assistant",
                "content": "",
                "tool_calls": [{
                    "id": str(uuid.uuid4()),
                    "function": {
                        "name": "confirm_changes",
                        "arguments": tool_call_args
                    }
                }]
            }
            
            messages = messages + [tool_response, confirm_tool_call]
            # messages = messages + [tool_response]
            
            # Return Command to route to end
            await copilotkit_exit(config)
            return Command(
                goto=END,
                update={
                    "messages": messages,
                    # "haiku": tool_call_args["haiku"]
                }
            )
    
        if tool_call_name == "render_haiku":
        # Add the tool response to messages
            tool_response = {
                "role": "tool",
                "content": "Generated haiku confirmed",
                "tool_call_id": tool_call_id
            }
            
            
            render_tool_call = {
                "role": "assistant",
                "content": "",
                "tool_calls": [{
                    "id": str(uuid.uuid4()),
                    "function": {
                        "name": "render_haiku",
                        "arguments": tool_call_args
                    }
                }]
            }
            
            # messages = messages + [tool_response, render_tool_call]
            
            # Return Command to route to end
            await copilotkit_exit(config)
            return Command(
                goto=END,
                update={
                    "messages": messages,
                }
            )
    
    # If no tool was called, go to end
    await copilotkit_exit(config)
    return Command(
        goto=END,
        update={
            "messages": messages
        }
    )


# Define the graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("start_flow", start_flow)
workflow.add_node("chat_node", chat_node)

# Add edges
workflow.set_entry_point("start_flow")
workflow.add_edge(START, "start_flow")
workflow.add_edge("start_flow", "chat_node")
workflow.add_edge("chat_node", END)

# Compile the graph
ag_ui_graph = workflow.compile(checkpointer=MemorySaver())
