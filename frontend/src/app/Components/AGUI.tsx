"use client"

import { CopilotChat, useCopilotChatSuggestions } from "@copilotkit/react-ui"
import { suggestionPrompt } from "../prompts"
import { useCoAgent, useCoAgentStateRender, useCopilotAction, useCopilotChat } from "@copilotkit/react-core"
import { useEffect, useState } from "react"
export const AGUI = () => {
    const [japanese, setJapanese] = useState<string[]>([])
    const [english, setEnglish] = useState<string[]>([])
    const { visibleMessages } = useCopilotChat()
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
                                    <p className="text-gray-700">Extracting data from {item.url}</p>
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
                            <p>{japanese[0]}</p>
                            <p>{japanese[1]}</p>
                            <p>{japanese[2]}</p>
                        </div>
                        <div>
                            <p>{english[0]}</p>
                            <p>{english[1]}</p>
                            <p>{english[2]}</p>
                        </div>
                    </div>
                    {/* {accepted === null && (
                        <div className="flex justify-end space-x-4">
                            <button
                                className={`bg-gray-200 text-black py-2 px-4 rounded disabled:opacity-50 ${status === "executing" ? "cursor-pointer" : "cursor-default"
                                    }`}
                                disabled={status !== "executing"}
                                onClick={() => {
                                    if (respond) respond("Changes rejected")
                                    else return
                                    setAccepted(false)
                                }}
                            >
                                Reject
                            </button>
                            <button
                                className={`bg-black text-white py-2 px-4 rounded disabled:opacity-50 ${status === "executing" ? "cursor-pointer" : "cursor-default"
                                    }`}
                                disabled={status !== "executing"}
                                onClick={() => {
                                    if (respond) respond("Changes accepted")
                                    else return
                                    setAccepted(true)
                                    setJapanese(args.japanese)
                                    setEnglish(args.english)
                                }}
                            >
                                Confirm
                            </button>
                        </div>
                    )}
                    {accepted !== null && (
                        <div className="flex justify-end">
                            <div className="mt-4 bg-gray-200 text-black py-2 px-4 rounded inline-block">
                                {accepted ? "✓ Accepted" : "✗ Rejected"}
                            </div>
                        </div>
                    )} */}
                </div>
            )
        }
    })

    useCopilotAction({
        name: "render_haiku",
        description: "Render the Confirmed haikus",
        render: () => {
            console.log("japanese", japanese)
            console.log("english", english)
            return (
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 max-w-2xl mx-auto my-4">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Japanese</h3>
                            <div className="space-y-2 text-black">
                                <p className="text-xl">{japanese[0]}</p>
                                <p className="text-xl">{japanese[1]}</p>
                                <p className="text-xl">{japanese[2]}</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">English</h3>
                            <div className="space-y-2">
                                <p className="text-gray-600">{english[0]}</p>
                                <p className="text-gray-600">{english[1]}</p>
                                <p className="text-gray-600">{english[2]}</p>
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
