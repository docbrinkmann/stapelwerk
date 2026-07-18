"use client"

import { SettingsLayout } from "@/components/settings"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Sun, Moon, Monitor, Check } from "lucide-react"
import {
  ACCENTS,
  ACCENT_KEY,
  FONT_SIZE_KEY,
  applyAccent,
  applyFontSize,
} from "@/lib/appearance"

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme()
  const [accent, setAccent] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState("default")

  // Reflect the persisted prefs in the controls (they're already applied
  // app-wide on load via providers-root).
  useEffect(() => {
    setAccent(localStorage.getItem(ACCENT_KEY))
    setFontSize(localStorage.getItem(FONT_SIZE_KEY) ?? "default")
  }, [])

  const chooseAccent = (name: string) => {
    setAccent(name)
    localStorage.setItem(ACCENT_KEY, name)
    applyAccent(name)
  }

  const chooseFontSize = (size: string) => {
    setFontSize(size)
    localStorage.setItem(FONT_SIZE_KEY, size)
    applyFontSize(size)
  }

  return (
    <SettingsLayout 
      title="Appearance" 
      description="Customize the look and feel of the application"
    >
      <div className="space-y-8">
        {/* Theme Selection */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Theme</h3>
          <p className="text-sm text-muted-foreground">
            Select the theme for the application
          </p>
          
          <RadioGroup 
            value={theme} 
            onValueChange={setTheme}
            className="grid grid-cols-3 gap-4"
          >
            <div>
              <RadioGroupItem 
                value="light" 
                id="light" 
                className="peer sr-only" 
              />
              <Label
                htmlFor="light"
                className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Sun className="h-6 w-6 mb-3" />
                <span className="text-sm font-medium">Light</span>
              </Label>
            </div>
            
            <div>
              <RadioGroupItem 
                value="dark" 
                id="dark" 
                className="peer sr-only" 
              />
              <Label
                htmlFor="dark"
                className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Moon className="h-6 w-6 mb-3" />
                <span className="text-sm font-medium">Dark</span>
              </Label>
            </div>
            
            <div>
              <RadioGroupItem 
                value="system" 
                id="system" 
                className="peer sr-only" 
              />
              <Label
                htmlFor="system"
                className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Monitor className="h-6 w-6 mb-3" />
                <span className="text-sm font-medium">System</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        {/* Accent Color */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Accent Color</h3>
          <p className="text-sm text-muted-foreground">
            Choose your preferred accent color
          </p>
          
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => chooseAccent(color.name)}
                style={{ backgroundColor: color.color }}
                className={`flex h-8 w-8 items-center justify-center rounded-full ring-offset-background transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${accent === color.name ? "ring-2 ring-ring ring-offset-2" : ""}`}
                aria-label={`Select ${color.name} color`}
                aria-pressed={accent === color.name}
              >
                {accent === color.name && <Check className="h-4 w-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Font Size */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Font Size</h3>
          <p className="text-sm text-muted-foreground">
            Adjust the font size for better readability
          </p>
          
          <RadioGroup value={fontSize} onValueChange={chooseFontSize} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="small" id="small" />
              <Label htmlFor="small" className="text-sm cursor-pointer">Small</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="default" id="default" />
              <Label htmlFor="default" className="text-base cursor-pointer">Default</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="large" id="large" />
              <Label htmlFor="large" className="text-lg cursor-pointer">Large</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </SettingsLayout>
  )
}
