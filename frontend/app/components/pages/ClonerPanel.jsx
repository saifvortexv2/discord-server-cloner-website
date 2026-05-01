'use client'
import axios from 'axios'
import { Check, ChevronDown, CircleQuestionMark, ClipboardPaste, Copy, Loader, LockKeyhole, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import React, { useState, useEffect, useRef } from 'react'
import Notification from '../Notification'
import { io } from 'socket.io-client'

const ClonerPanel = () => {
    const menuRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCopy, setSelectedCopy] = useState({
        all: true,
        channels: false,
        roles: false,
        emojis: false,
    });
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [logs, setLogs] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [values, setValues] = useState({
        token: "",
        copyId: "",
        pasteId: ""
    });

    const terminalRef = useRef(null);

    useEffect(() => {
        const socket = io('http://localhost:4000');
        socket.on('terminal-log', (log) => {
            setLogs(prev => [...prev, { text: log, id: Date.now() + Math.random() }]);
        });
        socket.on('cloning-complete', () => {
            setIsLoading(false);
            setIsFinished(true);
            addNotification("Cloning complete! Thank you. <3");
        });
        return () => socket.disconnect();
    }, []);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs]);

    const addNotification = (message, status = "success") => {
        const id = Date.now();
        setNotifications(prev => [...prev, { message, id, status }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 3000);
    }

    const toggleOption = (option) => {
        if (option === 'all') {
            setSelectedCopy({ all: !selectedCopy.all, channels: false, roles: false, emojis: false });
        } else {
            setSelectedCopy(prev => ({ ...prev, all: false, [option]: !prev[option] }));
        }
    }

    const removeOption = (option) => {
        setSelectedCopy(prev => ({ ...prev, [option]: false }));
    }

    const handleSubmit = async () => {
        const cleanedToken = values.token.replace(/"/g, "");

        try {
            const res = await axios.post(`http://localhost:4000/api/copy`, {
                token: cleanedToken,
                copyId: values.copyId,
                pasteId: values.pasteId,
                selectedOptions: selectedCopy
            });
            const data = res.data;
            if (data.success) {
                setIsLoading(true);
            } else {
                addNotification(data.message, "error");
            }
        } catch (error) {
            addNotification(error.response?.data?.message || "Error occurred", "error");
        }
    }

    const activeChips = Object.keys(selectedCopy).filter(key => selectedCopy[key]);

    useEffect(() => {
        const handleClick = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsDropdownOpen(false)
            }
        }

        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, []);

    return (
        <>
            <Notification notifications={notifications} setNotifications={setNotifications} />
            <section className='w-full h-full flex items-center justify-center font-inter'>
                <div className='w-[500px] h-[750px] bg-white/5 border border-white/7 rounded-2xl py-6 px-6 flex flex-col gap-8 items-center shadow-md'>

                    <h1 className='title font-[500] text-white text-2xl'>Discord Server Cloner</h1>
                    <div className='w-full flex flex-col gap-4 h-full'>
                        <div className='text-white/70 flex flex-col gap-3'>
                            <div className='flex flex-col gap-1 w-full'>
                                <label htmlFor="token" className='text-white'>Account Token</label>
                                <div className='w-full bg-white/10 border border-white/7 rounded-xl py-2.5 px-3 flex gap-2 items-center'>
                                    <LockKeyhole size={20} strokeWidth={2} />
                                    <input id='token' name='token' type="text" placeholder='Ex. MTEwNDMxOTA2N...' className='focus:outline-none flex-1 h-full select-none bg-transparent text-white'
                                        onChange={(e) => setValues(prev => ({ ...prev, token: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className='flex flex-col gap-1 w-full'>
                                <label htmlFor="copy" className='text-white'>Server Copy ID</label>
                                <div className='w-full bg-white/10 border border-white/7 rounded-xl py-2.5 px-3 flex gap-2 items-center'>
                                    <Copy size={20} strokeWidth={2} />
                                    <input id='copy' name='copyId' type="text" placeholder='Ex. 1498053905815310379' className='focus:outline-none flex-1 h-full select-none bg-transparent text-white'
                                        onChange={(e) => setValues(prev => ({ ...prev, copyId: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className='flex flex-col gap-1 w-full'>
                                <label htmlFor="paste" className='text-white'>Server Paste ID</label>
                                <div className='w-full bg-white/10 border border-white/7 rounded-xl py-2.5 px-3 flex gap-2 items-center'>
                                    <ClipboardPaste size={20} strokeWidth={2} />
                                    <input id='paste' name='pasteId' type="text" placeholder='Ex. 1493778589508829304' className='focus:outline-none flex-1 h-full select-none bg-transparent text-white'
                                        onChange={(e) => setValues(prev => ({ ...prev, pasteId: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className='flex flex-col gap-1 w-full'>
                                <span className='text-white'>Select what you want to copy</span>

                                <div ref={menuRef} className='relative w-full bg-white/10 border border-white/7 cursor-pointer rounded-xl py-2 px-3 flex items-center gap-2 flex-wrap min-h-[48px]'
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                                    <div className='flex items-center gap-2 flex-1 flex-wrap'>
                                        <CircleQuestionMark size={20} strokeWidth={2} className='shrink-0' />
                                        {activeChips.length === 0 && (
                                            <span className='text-sm opacity-50'>Select options...</span>
                                        )}
                                        <AnimatePresence mode='popLayout'>
                                            {activeChips.map(chip => (
                                                <motion.div 
                                                    key={chip}
                                                    initial={{ scale: 0, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0, opacity: 0 }}
                                                    layout
                                                    className="flex items-center gap-1 bg-white/10 border border-white/10 px-2 py-0.5 rounded-lg text-xs text-white"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <span className="capitalize">{chip}</span>
                                                    <X size={12} className="cursor-pointer hover:text-red-400" onClick={() => removeOption(chip)} />
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                    
                                    <AnimatePresence>
                                        {isDropdownOpen && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                transition={{ duration: 0.15 }}
                                                className='absolute w-full top-full left-0 mt-2 bg-gradient-to-b from-black to-[#0b0b0f] py-3 px-2.5 rounded-xl flex flex-col gap-1 z-50 border border-white/10 shadow-2xl origin-top'>
                                                <span onClick={(e) => { e.stopPropagation(); toggleOption('all'); }} className={`flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-xl transition-colors duration-200 ${selectedCopy.all ? 'text-green-500' : ''}`}>
                                                    All {selectedCopy.all && <Check />}
                                                </span>
                                                <span onClick={(e) => { e.stopPropagation(); toggleOption('channels'); }} className={`flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-xl transition-colors duration-150 ${selectedCopy.channels ? 'text-green-500' : ''}`}>
                                                    Channels {selectedCopy.channels && <Check />}
                                                </span>
                                                <span onClick={(e) => { e.stopPropagation(); toggleOption('roles'); }} className={`flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-xl transition-colors duration-150 ${selectedCopy.roles ? 'text-green-500' : ''}`}>
                                                    Roles {selectedCopy.roles && <Check />}
                                                </span>
                                                <span onClick={(e) => { e.stopPropagation(); toggleOption('emojis'); }} className={`flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-xl transition-colors duration-150 ${selectedCopy.emojis ? 'text-green-500' : ''}`}>
                                                    Emojis {selectedCopy.emojis && <Check />}
                                                </span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <motion.div
                                        animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                        className='shrink-0'
                                    >
                                        <ChevronDown size={20} />
                                    </motion.div>
                                </div>
                            </div>

                        </div>

                        <div className="w-full h-[200px] flex items-center justify-center">

                            <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl bg-zinc-950 border border-zinc-800 flex flex-col">
                                <div className="h-10 bg-zinc-900 flex items-center px-3 gap-2 shrink-0">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                </div>
                                <div ref={terminalRef} className="w-full flex-1 bg-black p-2 font-mono text-[10px] text-green-500 overflow-y-auto custom-scrollbar">
                                    {logs.map(log => (
                                        <div key={log.id} className="mb-0.5">
                                            {log.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {!isLoading ? (
                            <button
                                onClick={!isFinished ? handleSubmit : undefined}
                                className={`flex gap-2 text-white rounded-2xl bg-white/10 border border-white/5 transition-colors duration-150 py-2.5 w-full items-center justify-center ${isFinished ? 'cursor-default' : 'hover:bg-white/15 cursor-pointer'}`}>
                                {isFinished ? "Thank you. <3" : (
                                    <>
                                        Start Cloning
                                        <ClipboardPaste size={22} strokeWidth={1.6} />
                                    </>
                                )}
                            </button>
                        ) : (

                            <button disabled className='flex gap-2 text-white rounded-2xl bg-white/10 opacity-75 cursor-not-allowed border border-white/5 py-2.5 w-full items-center justify-center'>
                                Cloning ..
                                <Loader size={22} strokeWidth={1.6} className='animate-spin' />
                            </button>
                        )}

                        <div className="text-center text-white/70 text-[14px]">
                            © All rights reserved{" "}<Link href="https://discord.com/users/1258192443120287757" target="_blank" className="text-white hover:underline font-[500]" >Vortex</Link>.
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}

export default ClonerPanel
