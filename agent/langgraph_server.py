from fastapi import FastAPI
import uuid
from typing import Dict, List, Any, Optional

# LangGraph imports
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, END, START
from langgraph.types import Command
from langgraph.checkpoint.memory import MemorySaver

# CopilotKit imports
from copilotkit import CopilotKitState, CopilotKitSDK, LangGraphAgent
from copilotkit.langgraph import (
    copilotkit_customize_config
)
from copilotkit.langgraph import (copilotkit_exit)
from copilotkit.integrations.fastapi import add_fastapi_endpoint
# OpenAI imports
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

from agent import ag_ui_graph

app = FastAPI()

sdk = CopilotKitSDK(
    agents=[
        # Register the LangGraph agent using the LangGraphAgent class
        LangGraphAgent(
            name="AG_UI",
            description="An example for showcasing the  AGUI protocol using LangGraph.",
            graph=ag_ui_graph
        ),
    ]
)

add_fastapi_endpoint(app, sdk, "/copilotkit")


@app.get("/")
async def root():
    return {"message": "Hello World!!"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

