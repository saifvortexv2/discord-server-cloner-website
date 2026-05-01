'use client'
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const Notification = ({ notifications, setNotifications }) => {
    return (
        <div className='absolute top-4 right-4 z-999 flex flex-col gap-2'>
            <AnimatePresence>
                {notifications.map((n, i) => (
                    <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: .2, ease: "linear" }}
                        exit={{ opacity: 0, x: 2 }}
                        className='flex gap-1 bg-white/16 text-white/70 py-2 px-4 rounded-2xl items-center'
                    >
                        {n.message}
                        <X size={18} strokeWidth={3} className='text-white cursor-pointer' onClick={() => setNotifications(prev => prev.filter(e => e.id !== n.id))} />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}

export default Notification
