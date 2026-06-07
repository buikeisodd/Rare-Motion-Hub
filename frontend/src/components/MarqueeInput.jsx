import React, { useState, useRef, useEffect } from 'react';

export default function MarqueeInput({ value, onChange, onBlur, className, placeholder, textClassName, readOnly = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const containerRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    if (!isEditing && containerRef.current && textRef.current) {
      setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth);
    }
  }, [value, isEditing]);

  const handleBlur = (e) => {
    setIsEditing(false);
    if (onBlur) onBlur(e);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  if (isEditing && !readOnly) {
    return (
      <input
        autoFocus
        value={value}
        onChange={onChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`w-full bg-transparent outline-none ${className}`}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        readOnly={readOnly}
      />
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`w-full overflow-hidden ${!readOnly ? 'cursor-text' : ''} ${className}`} 
      onClick={(e) => {
        if (!readOnly) {
          e.preventDefault(); 
          e.stopPropagation(); 
          setIsEditing(true); 
        }
      }}
    >
      <div 
        className={`flex w-fit ${isOverflowing ? 'animate-marquee hover:[animation-play-state:paused]' : ''}`}
      >
        <span ref={textRef} className={`whitespace-nowrap ${textClassName || ''} ${isOverflowing ? 'pr-8' : ''}`}>
          {value || placeholder}
        </span>
        {isOverflowing && (
          <span className={`whitespace-nowrap ${textClassName || ''} pr-8`} aria-hidden="true">
            {value || placeholder}
          </span>
        )}
      </div>
    </div>
  );
}
