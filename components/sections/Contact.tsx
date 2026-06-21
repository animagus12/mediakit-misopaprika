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
import { contactRepository } from "@/repositories"

const contactData = contactRepository.get()
const brandField = contactData.fields.find((f) => f.name === "brandName")!
const messageField = contactData.fields.find((f) => f.name === "message")!

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

    const subject = `Collaboration Inquiry from ${formData.brandName}`
    const body = `Brand: ${formData.brandName}\n\nCampaign Details:\n${formData.message}`
    const mailtoLink = `mailto:${contactData.mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

    window.location.href = mailtoLink
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{contactData.title}</h3>
        <p className="text-sm text-muted-foreground">{contactData.description}</p>
      </div>

      <Card className="rounded-lg">
        <CardContent className="space-y-6 pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">{brandField.label}</label>
              <Input
                name="brandName"
                value={formData.brandName}
                onChange={handleChange}
                placeholder={brandField.placeholder}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{messageField.label}</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder={messageField.placeholder}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground resize-none"
                rows={messageField.rows ?? 5}
              />
            </div>

            <Separator />

            <Button
              type="submit"
              className="w-full rounded-lg gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Send className="size-4" />
              {contactData.submitText}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
