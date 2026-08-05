import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
// AFTER index.css on purpose. The scale has to win over Tailwind's utilities,
// and an @import inside index.css cannot: postcss refuses one placed after
// @tailwind utilities and drops it, leaving a build that succeeds with none of
// the scale in it. Loading the raw stylesheet here puts it last in the cascade
// and keeps it out of Tailwind's purge. Do not fold this back into index.css.
import '@/type-pass.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
