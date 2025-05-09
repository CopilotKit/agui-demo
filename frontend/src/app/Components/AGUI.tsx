"use client"

import { CopilotChat, useCopilotChatSuggestions } from "@copilotkit/react-ui"
import { suggestionPrompt } from "../prompts"
import { useCopilotAction, useCopilotChat } from "@copilotkit/react-core"
import { useState } from "react"
export const AGUI = () => {
    const [japanese, setJapanese] = useState<string[]>([])
    const [english, setEnglish] = useState<string[]>([])
    const { visibleMessages } = useCopilotChat()
    useCopilotChatSuggestions({
        instructions: suggestionPrompt,
        minSuggestions: 1,
        maxSuggestions: 6,
    })

    useCopilotAction({
        name: "confirm_changes",
        description: "Confirm or reject the changes to the haiku",
        renderAndWaitForResponse: ({ status, args, respond }) => {
            let japanese = args.japanese
            let english = args.english
            // console.log("args", args)
            const [accepted, setAccepted] = useState<boolean | null>(null)
            return (
                <div className="bg-white p-6 rounded shadow-lg border text-black border-gray-200 mt-5 mb-5">
                    <h2 className="text-lg font-bold mb-4">Confirm Changes</h2>
                    <p className="mb-6">Do you want to accept the generated haiku?</p>
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
                    {accepted === null && (
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
                    )}
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
        <>
            <CopilotChat labels={
                {
                    initial : "Tell me a topic of your choice to create a haiku about it",
                }
            } className="h-screen w-screen py-6" />
        </>
    )
}
