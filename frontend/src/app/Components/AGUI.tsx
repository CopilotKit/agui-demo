"use client"

import { CopilotChat, useCopilotChatSuggestions } from "@copilotkit/react-ui"
import { suggestionPrompt } from "../prompts"
import { useCoAgent, useCoAgentStateRender, useCopilotAction, useCopilotChat } from "@copilotkit/react-core"
import { useEffect, useState, useRef } from "react"
import Image from "next/image"

export const AGUI = () => {
    const [japanese, setJapanese] = useState<string[]>([])
    const [english, setEnglish] = useState<string[]>([])
    const { visibleMessages } = useCopilotChat()
    
    // Track if haiku is accepted globally to prevent loops
    const [haikuAccepted, setHaikuAccepted] = useState(false)
    const respondedRef = useRef(false)
    
    // Add useCoAgent hook to track agent state and node
    const {
        state: agentState,
        nodeName
    } = useCoAgent<{
        document: string;
    }>({
        name: "AG_UI",
        initialState: {
            document: ""
        }
    })
    
    // Log node name and messages for debugging
    useEffect(() => {
        console.log("Current node name:", nodeName)
        console.log("Has accepted:", haikuAccepted)
        console.log("Responded ref:", respondedRef.current)
    }, [nodeName, haikuAccepted])
    
    // Reset the responded state when the node changes to start_flow
    useEffect(() => {
        if (nodeName === "start_flow" && !haikuAccepted) {
            respondedRef.current = false;
            console.log("Reset responded state for new flow");
        }
    }, [nodeName, haikuAccepted]);
    
    useCopilotChatSuggestions({
        instructions: suggestionPrompt,
        minSuggestions: 1,
        maxSuggestions: 6,
    })

    useCoAgentStateRender({
        name: "AG_UI",
        render: ({ state }) => {
            // Don't show verification components if haiku is already accepted
            if (haikuAccepted) {
                return null;
            }
            
            if (state.tavily_response) {
                console.log("state", state.tavily_response)
                return (
                    <div className="bg-white p-6 rounded shadow-lg border text-black border-gray-200 mt-5 mb-5" key={state.tavily_response.length}>
                        <div className="space-y-4">
                            {state.tavily_response.map((item: any, index: number) => (
                                <div key={index} className="flex items-center space-x-3">
                                    <div className="w-6 h-6 flex items-center justify-center">
                                        {item.completed ? (
                                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <div className="w-4 h-4 border-2 border-gray-300 rounded-full animate-spin border-t-black"></div>
                                        )}
                                    </div>
                                    <p className="text-gray-700">Extracting information from internet about {item.topic}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }
            else if (state.haiku_verification) {
                console.log("haiku verification state", state.haiku_verification)
                const { steps, japanese, english } = state.haiku_verification
                
                return (
                    <div className="bg-white p-6 rounded shadow-lg border text-black border-gray-200 mt-5 mb-5" key={state.haiku_verification.steps.length}>
                        <div className="space-y-4">
                            {steps.map((step: any, index: number) => (
                                <div key={index} className="flex items-center space-x-3">
                                    <div className="w-6 h-6 flex items-center justify-center">
                                        {step.completed ? (
                                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <div className="w-4 h-4 border-2 border-gray-300 rounded-full animate-spin border-t-black"></div>
                                        )}
                                    </div>
                                    <p className="text-gray-700">{step.task} - {step.completed ? " completed" : " in progress"} </p>
                                </div>
                            ))}
                        </div>
                        
                        <div className="mt-6" style={{ display: 'flex', gap: '2rem' }}>
                            <div>
                                {japanese && japanese.map((item: string, index: number) => (
                                    <p key={index} className="text-indigo-900">{item}</p>
                                ))}
                            </div>
                            <div>
                                {english && english.map((item: string, index: number) => (
                                    <p key={index} className="text-rose-700 italic">{item}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }
            else {
                return (null)
            }
        }
    })

    useCopilotAction({
        name: "render_haiku",
        description: "Render the Confirmed haikus",
        followUp: false,
        render: ({ status, args }) => {
            console.log("Rendering haiku with args:", args, "Status:", status, "Accepted:", haikuAccepted, "Responded:", respondedRef.current)
            const [userChoice, setUserChoice] = useState<string | null>(null)
            
            // Set haiku from args or use existing state
            useEffect(() => {
                if (args && args.japanese && args.english) {
                    setJapanese(args.japanese)
                    setEnglish(args.english)
                }
            }, [args])

            return (
                <div className="bg-gradient-to-br from-white to-blue-50 p-8 rounded-xl shadow-lg border border-blue-100 max-w-3xl my-6 transform hover:scale-[1.02] transition-transform duration-300">
                    <div className="grid grid-cols-2 gap-12">
                        <div className="space-y-6 relative">
                            <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-to-b from-indigo-400 to-indigo-200 rounded-full"></div>
                            <h3 className="text-xl font-medium text-indigo-800 mb-4 flex items-center">
                                <span className="mr-2">🇯🇵</span>
                                Japanese
                            </h3>
                            <div className="space-y-4 text-black">
                                {japanese.map((item: string, index: number) => (
                                    <p key={index} className="text-2xl font-light leading-relaxed tracking-wide text-indigo-900">{item}</p>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-6 relative">
                            <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-to-b from-rose-400 to-rose-200 rounded-full"></div>
                            <h3 className="text-xl font-medium text-rose-800 mb-4 flex items-center">
                                <span className="mr-2">🇬🇧</span>
                                English
                            </h3>
                            <div className="space-y-4">
                                {english.map((item: string, index: number) => (
                                    <p key={index} className="text-lg text-rose-700 leading-relaxed italic">{item}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                </div>
            )
        }
    })

    // For dev purposes. Will be removed in production.
    console.log("visibleMessages", visibleMessages)

    return (
        <div className="w-screen bg-white flex flex-col overflow-hidden" style={{ height: '100vh' }}>
            {/* Logo in the top left */}
            <div className="p-8 bg-white flex items-center">
                <div className="flex items-center mr-4">
                    <Image 
                        src="/copilotkit_logo.svg" 
                        alt="CopilotKit Logo" 
                        width={180} 
                        height={60}
                    />
                </div>
                {/* <h1 className="text-2xl font-light text-gray-200">Haiku Generator</h1> */}
            </div>
            
            {/* Welcome message that disappears when there are messages */}
            {visibleMessages.length === 0 && (
                <div className="absolute top-[25%] left-0 right-0 mx-auto w-full max-w-3xl z-40 pl-10">
                    <h1 className="text-4xl font-bold text-black mb-3">Hello there!</h1>
                    <p className="text-2xl text-gray-500">Tell me a topic to create a haiku about it.</p>
                </div>
            )}
            
            <div className="flex-1 flex justify-center items-center bg-white overflow-y-auto">
                <CopilotChat className="w-full max-w-3xl flex flex-col h-full py-6" />
            </div>
        </div>
    )
}
