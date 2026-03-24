import router from '@adonisjs/core/services/router'

const HomeController = () => import('#controllers/home_controller')

router.get('/', [HomeController, 'index'])
router.get('/health', async ({ response }) => response.ok({ status: 'ok' }))
