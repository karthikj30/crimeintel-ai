'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Globe, ChevronDown } from 'lucide-react';

// Supported languages configuration
const LANGUAGES = [
  { code: 'en', name: 'English',  nativeName: 'EN' },
  { code: 'hi', name: 'Hindi',    nativeName: 'हि' },
  { code: 'kn', name: 'Kannada',  nativeName: 'ಕ' },
  { code: 'ne', name: 'Nepali',   nativeName: 'ने' },
  { code: 'bn', name: 'Bengali',  nativeName: 'বা' },
];

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function setTranslateCookie(langCode) {
  // Google Translate reads this cookie on page load and on JS change
  const domain = window.location.hostname;
  const cookieVal = langCode === 'en' ? '/en/en' : `/en/${langCode}`;
  document.cookie = `googtrans=${cookieVal}; path=/; domain=.${domain}`;
  document.cookie = `googtrans=${cookieVal}; path=/`;
}

export default function GoogleTranslate() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');
  const dropdownRef = useRef(null);
  const pathname = usePathname();

  // Read initial language from cookie
  useEffect(() => {
    const googtrans = getCookie('googtrans');
    if (googtrans) {
      const lang = googtrans.split('/').pop();
      if (lang && LANGUAGES.some(l => l.code === lang)) {
        setCurrentLang(lang);
      }
    }
  }, []);

  // Load Google Translate script once
  useEffect(() => {
    if (document.getElementById('google-translate-script')) return;

    window.googleTranslateElementInit = () => {
      if (typeof window.google?.translate?.TranslateElement === 'function') {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,hi,kn,ne,bn',
            autoDisplay: false,
          },
          'google_translate_element'
        );
      }
    };

    const script = document.createElement('script');
    script.id = 'google-translate-script';
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // After route changes, re-apply the current language via the native combo box
  useEffect(() => {
    if (currentLang === 'en') return;
    const applyLang = () => {
      const select = document.querySelector('.goog-te-combo');
      if (select && select.value !== currentLang) {
        select.value = currentLang;
        select.dispatchEvent(new Event('change'));
      }
    };
    applyLang();
    const t = setTimeout(applyLang, 1000);
    return () => clearTimeout(t);
  }, [pathname, currentLang]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLanguageChange = (langCode) => {
    setIsOpen(false);

    if (langCode === currentLang) return;

    // 1. Try the native goog-te-combo select (fast, no page reload)
    const select = document.querySelector('.goog-te-combo');
    if (select) {
      select.value = langCode;
      select.dispatchEvent(new Event('change'));
      setCurrentLang(langCode);
      return;
    }

    // 2. Fallback: set the cookie and reload (reliable across all Google Translate versions)
    setTranslateCookie(langCode);
    setCurrentLang(langCode);
    window.location.reload();
  };

  const activeLanguage = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

  return (
    <div className="gt-custom-wrapper" ref={dropdownRef}>
      <button
        className="gt-custom-btn"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select language"
        title="Translate Website"
      >
        <Globe size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, letterSpacing: '0.02em' }}>
          {activeLanguage.nativeName}
        </span>
        <ChevronDown
          size={11}
          style={{
            flexShrink: 0,
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {isOpen && (
        <div className="gt-custom-dropdown" role="listbox">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              role="option"
              aria-selected={currentLang === lang.code}
              className={`gt-custom-option${currentLang === lang.code ? ' active' : ''}`}
              onClick={() => handleLanguageChange(lang.code)}
            >
              <span className="gt-native">{lang.nativeName}</span>
              <span className="gt-name">{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
