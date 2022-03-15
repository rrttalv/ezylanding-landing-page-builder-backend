export const compileTemplate = (templateId, pages, cssFiles, palette, framework, templateMeta) => {
  return {
    pages,
    templateId,
    cssFiles,
    palette,
    framework,
    templateMeta
  }
}

export const validateEmail = email => {
  if(!email || !email.length){
    return false
  }
  const addr = email.trim().toLowerCase()
  return addr && addr.length ? addr : false
}