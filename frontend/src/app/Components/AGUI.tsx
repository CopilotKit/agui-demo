"use client"

import { CopilotChat, useCopilotChatSuggestions } from "@copilotkit/react-ui"
import { suggestionPrompt } from "../prompts"
import { useCoAgent, useCoAgentStateRender, useCopilotAction, useCopilotChat } from "@copilotkit/react-core"
import { useEffect, useState } from "react"
export const AGUI = () => {
    const [japanese, setJapanese] = useState<string[]>([])
    const [english, setEnglish] = useState<string[]>([])
    const { visibleMessages, stopGeneration } = useCopilotChat()
    useCopilotChatSuggestions({
        instructions: suggestionPrompt,
        minSuggestions: 1,
        maxSuggestions: 6,
    })

    useCoAgentStateRender({
        name: "AG_UI",
        render: ({ state }) => {
            if (state.tavily_response) {
                
                console.log("state", state.tavily_response)
                return (
                    <div className="bg-white p-6 rounded shadow-lg border text-black border-gray-200 mt-5 mb-5">
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
            else {
                return (null)
            }
        }
    })


    // console.log("state", state)


    useCopilotAction({
        name: "haiku_master_verify",
        description: "Verify the generated haiku",
        renderAndWaitForResponse: ({ status, args, respond }) => {
            let japanese = args.japanese
            let english = args.english
            useEffect(() => {
                const timer = setTimeout(() => {
                    setCompleted(true)
                    if(respond){
                        setJapanese(args.japanese)
                        setEnglish(args.english)
                        respond("Successfully Verified the generated haiku by Haiku Master !!!")
                    }
                }, 3000)
                return () => clearTimeout(timer)
            }, [])
            // console.log("args", args)
            // const [accepted, setAccepted] = useState<boolean | null>(null)
            const [completed, setCompleted] = useState<boolean>(false)
            return (
                <div className="bg-white p-6 rounded shadow-lg border text-black border-gray-200 mt-5 mb-5">
                    <h2 className="text-lg font-bold mb-4">Haiku Verification</h2>
                    <div className="flex mb-6  items-center space-x-3">
                        <div className="w-6 h-6 flex items-center justify-center">
                            {completed ? (
                                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <div className="w-4 h-4 border-2 border-gray-300 rounded-full animate-spin border-t-black"></div>
                            )}
                        </div>
                        <p className="text-gray-700">{completed ? "Successfully Verified the generated haiku by Haiku Master !!!" : "Verifiying the generated haiku by Haiku Master"}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <div>
                            {japanese.map((item: string, index: number) => (
                                <p key={index}>{item}</p>
                            ))}
                        </div>
                        <div>
                            {english.map((item: string, index: number) => (
                                <p key={index}>{item}</p>
                            ))}
                        </div>
                    </div>
                </div>
            )
        }
    })

    useCopilotAction({
        name: "render_haiku",
        description: "Render the Confirmed haikus",
        render: () => {
            stopGeneration()
            console.log("japanese", japanese)
            console.log("english", english)
            return (
                <div className="bg-gradient-to-br from-white to-blue-50 p-8 rounded-xl shadow-lg border border-blue-100 max-w-3xl mx-auto my-6 transform hover:scale-[1.02] transition-transform duration-300">
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
        <div className="h-screen w-screen bg-white flex justify-center items-center">
            <CopilotChat labels={
                {
                    initial: "Tell me a topic of your choice to create a haiku about it",
                }
            } className="h-screen w-300 py-6" />
        </div>
    )
}
