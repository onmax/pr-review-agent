export default defineEventHandler((event) => {
  console.log(`[${new Date().toISOString()}] ${event.method} ${event.path}`)
})
