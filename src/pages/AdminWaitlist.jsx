import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { base44 } from "@/api/base44Client"
import { 
  Users, 
  Mail, 
  Calendar, 
  Download, 
  RefreshCw, 
  ArrowLeft,
  Trash2,
  Search,
  CheckCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { format } from "date-fns"

export default function AdminWaitlist() {
  const [searchTerm, setSearchTerm] = useState("")
  const [localSignups, setLocalSignups] = useState([])

  // Fetch from Base44 entity
  const { data: base44Signups, isLoading, refetch, error } = useQuery({
    queryKey: ["waitlistSignups"],
    queryFn: async () => {
      try {
        const signups = await base44.entities.WaitlistSignup.list()
        return signups || []
      } catch (err) {
        console.error("Error fetching from Base44:", err)
        return []
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Also check localStorage fallback
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("waitlist") || "[]")
      setLocalSignups(stored)
    } catch {
      setLocalSignups([])
    }
  }, [])

  // Combine and dedupe signups
  const allSignups = React.useMemo(() => {
    const combined = [...(base44Signups || []), ...localSignups]
    const seen = new Set()
    return combined
      .filter((signup) => {
        const email = signup.email?.toLowerCase()
        if (seen.has(email)) return false
        seen.add(email)
        return true
      })
      .sort((a, b) => new Date(b.signed_up_at) - new Date(a.signed_up_at))
  }, [base44Signups, localSignups])

  // Filter by search (email or first name)
  const filteredSignups = allSignups.filter((signup) => {
    const term = searchTerm.toLowerCase()
    return (
      signup.email?.toLowerCase().includes(term) ||
      signup.first_name?.toLowerCase().includes(term)
    )
  })

  // Export to CSV
  const exportToCSV = () => {
    const headers = ["First Name", "Email", "Signed Up At", "Source"]
    const rows = allSignups.map((s) => [
      s.first_name ?? "",
      s.email,
      s.signed_up_at,
      s.source || "landing_page",
    ])
    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
    
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pulseapp-waitlist-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div 
      className="min-h-screen p-6 md:p-10"
      style={{ backgroundColor: "hsl(45, 40%, 95%)" }}
    >
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link 
            to="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-serif font-semibold text-slate-900">
                Waitlist Signups
              </h1>
              <p className="text-slate-600 mt-1">
                Manage and export your PulseApp waitlist
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => refetch()}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                onClick={exportToCSV}
                className="gap-2 bg-[#FF6B35] hover:bg-[#E85A28]"
                disabled={allSignups.length === 0}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        >
          <div 
            className="p-6 rounded-2xl"
            style={{
              background: "rgba(255, 255, 255, 0.8)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.5)",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div className="flex items-center gap-4">
              <div 
                className="p-3 rounded-xl"
                style={{ background: "rgba(255, 107, 53, 0.1)" }}
              >
                <Users className="h-6 w-6 text-[#FF6B35]" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Signups</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {allSignups.length}
                </p>
              </div>
            </div>
          </div>

          <div 
            className="p-6 rounded-2xl"
            style={{
              background: "rgba(255, 255, 255, 0.8)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.5)",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div className="flex items-center gap-4">
              <div 
                className="p-3 rounded-xl"
                style={{ background: "rgba(34, 197, 94, 0.1)" }}
              >
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Today's Signups</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {allSignups.filter((s) => {
                    const signupDate = new Date(s.signed_up_at).toDateString()
                    return signupDate === new Date().toDateString()
                  }).length}
                </p>
              </div>
            </div>
          </div>

          <div 
            className="p-6 rounded-2xl"
            style={{
              background: "rgba(255, 255, 255, 0.8)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.5)",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div className="flex items-center gap-4">
              <div 
                className="p-3 rounded-xl"
                style={{ background: "rgba(59, 130, 246, 0.1)" }}
              >
                <Calendar className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600">This Week</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {allSignups.filter((s) => {
                    const signupDate = new Date(s.signed_up_at)
                    const weekAgo = new Date()
                    weekAgo.setDate(weekAgo.getDate() - 7)
                    return signupDate >= weekAgo
                  }).length}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white/80 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] transition-all"
            />
          </div>
        </motion.div>

        {/* Signups Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.5)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
          }}
        >
          {isLoading ? (
            <div className="p-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">Loading signups...</p>
            </div>
          ) : filteredSignups.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No signups yet</p>
              <p className="text-slate-500 text-sm mt-1">
                {searchTerm ? "Try a different search term" : "Signups will appear here"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      #
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Signed Up
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSignups.map((signup, index) => (
                    <motion.tr
                      key={signup.id || signup.email}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {signup.first_name || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                            style={{ background: "linear-gradient(135deg, #FF6B35 0%, #E85A28 100%)" }}
                          >
                            {(signup.first_name || signup.email)?.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-slate-900 font-medium">
                            {signup.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {signup.signed_up_at 
                          ? format(new Date(signup.signed_up_at), "MMM d, yyyy 'at' h:mm a")
                          : "Unknown"
                        }
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          {signup.source || "landing_page"}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Footer note */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Data refreshes automatically every 30 seconds
        </p>
      </div>
    </div>
  )
}
