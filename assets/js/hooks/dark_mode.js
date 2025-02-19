const DarkMode = {
  mounted() {
    // Set dark mode as default if no preference is stored
    if (!('theme' in localStorage)) {
      localStorage.theme = 'dark'
    }

    // Check stored preference
    if (localStorage.theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    this.el.addEventListener('click', () => {
      // Toggle dark mode
      if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark')
        localStorage.theme = 'light'
      } else {
        document.documentElement.classList.add('dark')
        localStorage.theme = 'dark'
      }
    })
  }
}

export default DarkMode 