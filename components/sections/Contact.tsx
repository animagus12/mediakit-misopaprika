"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Send } from "lucide-react"

export default function Contact() {
  const [formData, setFormData] = useState({
    brandName: "",
    message: ""
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.brandName || !formData.message) {
      alert("Please fill in all required fields")
      return
    }

    // Create mailto link with subject and body
    const subject = `Collaboration Inquiry from ${formData.brandName}`
    const body = `Brand: ${formData.brandName}\n\nCampaign Details:\n${formData.message}`
    const mailtoLink = `mailto:paprikaX1000@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    
    // Open default email client
    window.location.href = mailtoLink
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Let's Collaborate</h3>
        <p className="text-sm text-muted-foreground">Tell me about your project and I'll get back to you soon</p>
      </div>

      <Card className="rounded-lg">
        <CardContent className="space-y-6 pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Brand Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Brand Name *</label>
              <Input
                name="brandName"
                value={formData.brandName}
                onChange={handleChange}
                placeholder="Your brand or company name"
                className="rounded-lg"
              />
            </div>

            {/* Campaign Details */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tell me about your campaign *</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="What kind of video or content are you looking for? Share your ideas, budget, style preferences, or any specific requirements..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground resize-none"
                rows={5}
              />
            </div>

            <Separator />

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full rounded-lg gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Send className="size-4" />
              Send Inquiry
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
