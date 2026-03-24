import { ExceptionHandler, type HttpContext } from '@adonisjs/core/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = process.env.NODE_ENV !== 'production'

  async handle(error: unknown, ctx: HttpContext) {
    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
