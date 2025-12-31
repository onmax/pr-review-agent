import { consola } from 'consola'

export default defineEventHandler((event) => {
  consola.info(`${event.method} ${event.path}`)
})
