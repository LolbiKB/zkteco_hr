import { useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { X, ChevronsUpDown } from "lucide-react"

// ========================================
// HEADER COMPONENTS (Filters)
// ========================================

interface SelectFilterHeaderProps {
  title: string
  currentFilter?: string
  options: Array<{ value: string; label: string }>
  onFilterChange: (value: string) => void
  disabled?: boolean
}

export function SelectFilterHeader({
  title,
  currentFilter,
  options,
  onFilterChange,
  disabled = false
}: SelectFilterHeaderProps) {
  return (
    <div className="flex items-center gap-1 w-full">
      <Select
        value={currentFilter || undefined}
        onValueChange={onFilterChange}
        disabled={disabled}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={`All ${title}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {currentFilter && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
          onClick={() => onFilterChange('')}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  )
}

interface DateFilterHeaderProps {
  title: string
  currentFilter?: Date
  onFilterChange: (date: Date | undefined) => void
  maxDate?: Date
}

export function DateFilterHeader({
  title,
  currentFilter,
  onFilterChange,
  maxDate = new Date()
}: DateFilterHeaderProps) {
  return (
    <div className="flex items-center gap-1 w-full">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="flex-1 justify-between min-w-0"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="truncate">
                {currentFilter ? format(currentFilter, 'MMM dd, yyyy') : `All ${title}`}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={currentFilter}
            captionLayout="dropdown"
            disabled={(date) => date > maxDate}
            onSelect={onFilterChange}
          />
        </PopoverContent>
      </Popover>
      {currentFilter && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
          onClick={() => onFilterChange(undefined)}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  )
}

// ========================================
// CELL COMPONENTS (Data Display)
// ========================================

interface TwoLineTextCellProps {
  mainText: string
  secondaryText?: string
  mainClassName?: string
  secondaryClassName?: string
}

export function TwoLineTextCell({
  mainText,
  secondaryText,
  mainClassName = "",
  secondaryClassName = "text-sm text-muted-foreground"
}: TwoLineTextCellProps) {
  return (
    <div className="space-y-0.5">
      <div className={mainClassName}>
        <span>{mainText}</span>
      </div>
      {secondaryText && (
        <div className={secondaryClassName}>
          <span>{secondaryText}</span>
        </div>
      )}
    </div>
  )
}

interface BadgeCellProps {
  text: string
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

export function BadgeCell({
  text,
  variant = 'secondary'
}: BadgeCellProps) {
  return <Badge variant={variant}>{text}</Badge>
}
