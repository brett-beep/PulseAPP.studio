import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Mail, User, CheckCircle, Loader2, Sparkles } from "lucide-react"
import { base44 } from "@/api/base44Client"
import {
  trackWaitlistModalOpened,
  trackWaitlistModalClosed,
  trackWaitlistFormSubmit,
} from "@/lib/mixpanel"

export function WaitlistModal({ isOpen, onClose, onSuccess }) {
  const [firstName, setFirstName] = useState("")
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")

  // Track modal opened
  useEffect(() => {
    if (isOpen) {
      trackWaitlistModalOpened('CTA Button')
    }
  }, [isOpen])

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        trackWaitlistModalClosed('esc', isSuccess)
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose, isSuccess])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setFirstName("")
        setEmail("")
        setIsSuccess(false)
        setError("")
      }, 300)
    }
  }, [isOpen])

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (!email.trim()) {
      setError("Please enter your email address")
      return
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address")
      return
    }

    setIsSubmitting(true)

    try {
      // Try cloud function first
      const response = await base44.functions.invoke("joinWaitlist", {
        firstName: firstName.trim() || undefined,
        email: email.toLowerCase().trim(),
        source: "landing_page",
      })

      if (response.data?.success) {
        setIsSuccess(true)
        trackWaitlistFormSubmit('success')
        if (onSuccess) onSuccess()
      } else if (response.data?.alreadyExists) {
        setError("This email is already on the waitlist!")
        trackWaitlistFormSubmit('already_exists')
      } else {
        throw new Error(response.data?.error || "Failed to join waitlist")
      }
    } catch (err) {
      console.error("Waitlist signup error:", err)
      
      // Check if it's a duplicate email error
      if (err.message?.includes("duplicate") || err.message?.includes("already exists") || err.message?.includes("already on the waitlist")) {
        setError("This email is already on the waitlist!")
        trackWaitlistFormSubmit('already_exists')
      } else {
        // Fallback: try direct entity creation
        try {
          await base44.entities.WaitlistSignup.create({
            first_name: firstName.trim() || undefined,
            email: email.toLowerCase().trim(),
            signed_up_at: new Date().toISOString(),
            source: "landing_page",
          })
          setIsSuccess(true)
          trackWaitlistFormSubmit('success')
          if (onSuccess) onSuccess()
        } catch (entityErr) {
          // Final fallback: save to localStorage
          try {
            const existing = JSON.parse(localStorage.getItem("waitlist") || "[]")
            if (existing.some((e) => e.email === email.toLowerCase().trim())) {
              setError("This email is already on the waitlist!")
              trackWaitlistFormSubmit('already_exists')
            } else {
              existing.push({
                first_name: firstName.trim() || undefined,
                email: email.toLowerCase().trim(),
                signed_up_at: new Date().toISOString(),
                source: "landing_page",
              })
              localStorage.setItem("waitlist", JSON.stringify(existing))
              setIsSuccess(true)
              trackWaitlistFormSubmit('success')
              if (onSuccess) onSuccess()
            }
          } catch {
            setError("Something went wrong. Please try again.")
            trackWaitlistFormSubmit('error', 'localStorage fallback failed')
          }
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              trackWaitlistModalClosed('outside_click', isSuccess)
              onClose()
            }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div 
              className="relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(255, 253, 250, 0.98) 0%, rgba(255, 248, 240, 0.98) 100%)",
                border: "1px solid rgba(255, 107, 53, 0.15)",
                boxShadow: `
                  0 25px 50px -12px rgba(0, 0, 0, 0.15),
                  0 0 0 1px rgba(255, 255, 255, 0.5) inset,
                  0 0 80px rgba(255, 107, 53, 0.1)
                `,
              }}
            >
              {/* Close button */}
              <button
                onClick={() => {
                  trackWaitlistModalClosed('x_button', isSuccess)
                  onClose()
                }}
                className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors z-10"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Content */}
              <div className="p-8 pt-10">
                <AnimatePresence mode="wait">
                  {!isSuccess ? (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      {/* Header */}
                      <div className="text-center mb-8">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                          style={{
                            background: "linear-gradient(135deg, #FF6B35 0%, #FF8F5C 100%)",
                            boxShadow: "0 8px 24px rgba(255, 107, 53, 0.3)",
                          }}
                        >
                          <Sparkles className="h-8 w-8 text-white" />
                        </motion.div>
                        
                        <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-2">
                          Join the Waitlist
                        </h2>
                        <p className="text-slate-600">
                          Be the first to experience AI-powered market briefings. 
                          Early access starts soon.
                        </p>
                      </div>

                      {/* Form */}
                      <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                              type="text"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              placeholder="First name"
                              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 bg-white/80 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] transition-all"
                              disabled={isSubmitting}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="mb-4">
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="Enter your email"
                              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 bg-white/80 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] transition-all"
                              disabled={isSubmitting}
                            />
                          </div>
                          {error && (
                            <motion.p
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-2 text-sm text-red-500 pl-1"
                            >
                              {error}
                            </motion.p>
                          )}
                        </div>

                        <motion.button
                          type="submit"
                          disabled={isSubmitting}
                          whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                          whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                          className="w-full py-4 rounded-2xl font-semibold text-white transition-all disabled:opacity-70"
                          style={{
                            background: "linear-gradient(135deg, #FF6B35 0%, #E85A28 100%)",
                            boxShadow: "0 8px 24px rgba(255, 107, 53, 0.35)",
                          }}
                        >
                          {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              Joining...
                            </span>
                          ) : (
                            "Get Early Access"
                          )}
                        </motion.button>
                      </form>

                      <p className="mt-4 text-center text-xs text-slate-500">
                        No spam, ever. We'll only email you about your early access.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-center py-6"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                        className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
                        style={{
                          background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
                          boxShadow: "0 8px 24px rgba(34, 197, 94, 0.3)",
                        }}
                      >
                        <CheckCircle className="h-10 w-10 text-white" />
                      </motion.div>

                      <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-2">
                        You're on the list!
                      </h2>
                      <p className="text-slate-600 mb-6">
                        Thanks for joining! We'll reach out soon with your early access invitation.
                      </p>

                      <div 
                        className="p-4 rounded-2xl mb-6"
                        style={{ background: "rgba(255, 107, 53, 0.08)" }}
                      >
                        <p className="text-sm text-slate-700">
                          <span className="font-medium">Signed up as:</span>
                          <br />
                          {firstName.trim() && (
                            <span className="text-[#FF6B35] font-medium">{firstName.trim()}</span>
                          )}
                          {firstName.trim() && <br />}
                          <span className="text-[#FF6B35] font-medium">{email}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          trackWaitlistModalClosed('submitted', true)
                          onClose()
                        }}
                        className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
                      >
                        Close
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
