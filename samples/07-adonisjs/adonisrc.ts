import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  commands: [() => import('@adonisjs/core/commands')],
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@bella-baxter/config/adonis'),
  ],
  preloads: [
    () => import('#start/routes'),
    () => import('#start/kernel'),
  ],
  tests: { suites: [], forceExit: false },
  metaFiles: [],
})
