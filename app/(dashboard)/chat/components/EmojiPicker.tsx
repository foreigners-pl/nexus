'use client'

import { useState } from 'react'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
}

// Frequently used emojis (shown first)
const FREQUENT_EMOJIS = [
  '\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', 
  '\u{1F621}', '\u{1F389}', '\u{1F525}', '\u{2705}', '\u{1F44F}'
]

// All other emojis
const ALL_EMOJIS = [
  // Smileys
  '\u{1F600}', '\u{1F603}', '\u{1F604}', '\u{1F601}', '\u{1F606}', 
  '\u{1F605}', '\u{1F923}', '\u{1F602}', '\u{1F642}', '\u{1F60A}',
  '\u{1F607}', '\u{1F970}', '\u{1F60D}', '\u{1F929}', '\u{1F618}',
  '\u{1F617}', '\u{1F61A}', '\u{1F619}', '\u{1F972}', '\u{1F60B}',
  '\u{1F61B}', '\u{1F61C}', '\u{1F92A}', '\u{1F61D}', '\u{1F911}',
  '\u{1F914}', '\u{1F910}', '\u{1F928}', '\u{1F610}', '\u{1F611}',
  '\u{1F636}', '\u{1F60F}', '\u{1F612}', '\u{1F644}', '\u{1F62C}',
  '\u{1F925}', '\u{1F60C}', '\u{1F614}', '\u{1F62A}', '\u{1F924}',
  '\u{1F634}', '\u{1F637}', '\u{1F912}', '\u{1F915}', '\u{1F922}',
  '\u{1F92E}', '\u{1F927}', '\u{1F975}', '\u{1F976}', '\u{1F974}',
  '\u{1F635}', '\u{1F92F}', '\u{1F920}', '\u{1F973}', '\u{1F978}',
  '\u{1F60E}', '\u{1F913}', '\u{1F9D0}', '\u{1F615}', '\u{1F61F}',
  '\u{1F641}', '\u{1F62E}', '\u{1F62F}', '\u{1F632}', '\u{1F633}',
  '\u{1F97A}', '\u{1F626}', '\u{1F627}', '\u{1F628}', '\u{1F630}',
  '\u{1F625}', '\u{1F622}', '\u{1F62D}', '\u{1F631}', '\u{1F616}',
  '\u{1F623}', '\u{1F61E}', '\u{1F613}', '\u{1F629}', '\u{1F62B}',
  '\u{1F624}', '\u{1F621}', '\u{1F620}', '\u{1F92C}', '\u{1F608}',
  '\u{1F47F}', '\u{1F480}', '\u{1F4A9}', '\u{1F921}', '\u{1F479}',
  // Gestures
  '\u{1F44B}', '\u{1F91A}', '\u{270B}', '\u{1F596}',
  '\u{1F44C}', '\u{1F90F}', '\u{270C}\u{FE0F}', '\u{1F91E}',
  '\u{1F91F}', '\u{1F918}', '\u{1F919}', '\u{1F448}', '\u{1F449}',
  '\u{1F446}', '\u{1F447}', '\u{1F44D}', '\u{1F44E}',
  '\u{270A}', '\u{1F44A}', '\u{1F91B}', '\u{1F91C}', '\u{1F44F}',
  '\u{1F64C}', '\u{1F450}', '\u{1F64F}', '\u{1F91D}', '\u{1F485}',
  // Hearts
  '\u{2764}\u{FE0F}', '\u{1F9E1}', '\u{1F49B}', '\u{1F49A}', '\u{1F499}',
  '\u{1F49C}', '\u{1F5A4}', '\u{1F90D}', '\u{1F90E}', '\u{1F494}',
  '\u{1F495}', '\u{1F49E}', '\u{1F493}', '\u{1F497}', '\u{1F496}',
  '\u{1F498}', '\u{1F49D}', '\u{1F49F}', '\u{2763}\u{FE0F}', '\u{1F48B}',
  // Objects & Symbols
  '\u{2705}', '\u{274C}', '\u{2753}', '\u{2757}', '\u{1F4AF}',
  '\u{1F389}', '\u{1F38A}', '\u{1F381}', '\u{1F3C6}', '\u{1F947}',
  '\u{1F948}', '\u{1F949}', '\u{1F525}', '\u{2B50}', '\u{1F31F}',
  '\u{1F4A5}', '\u{1F4AB}', '\u{1F4A2}', '\u{1F4A6}', '\u{1F4A8}',
  '\u{1F440}', '\u{1F4AC}', '\u{1F4AD}', '\u{1F4A4}', '\u{1F4AA}'
]

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div 
      className="rounded-2xl shadow-2xl shadow-black/30 p-3 w-72 border border-white/10 z-50" 
      style={{ backgroundColor: 'hsl(240 3% 12%)' }} 
      onClick={(e) => e.stopPropagation()}
    >
      {/* Frequent emojis */}
      <div className="grid grid-cols-8 gap-1">
        {FREQUENT_EMOJIS.map((emoji, index) => (
          <button
            key={index}
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center text-xl hover:bg-white/10 rounded-lg transition-all duration-150 hover:scale-110 active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>
      
      {/* Expanded section */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="grid grid-cols-8 gap-1 max-h-44 overflow-y-auto scrollbar-thin pr-1">
            {ALL_EMOJIS.map((emoji, index) => (
              <button
                key={index}
                onClick={() => onSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center text-xl hover:bg-white/10 rounded-lg transition-all duration-150 hover:scale-110 active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* More/Less button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full mt-3 py-2 text-xs font-medium text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5"
      >
        {expanded ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            Show Less
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Show More
          </>
        )}
      </button>
    </div>
  )
}
