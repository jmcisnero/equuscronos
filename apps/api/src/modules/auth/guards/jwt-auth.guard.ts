import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const path = request.path || request.url;

    // Solo protegemos los endpoints bajo el prefijo admin/
    if (!path.startsWith('/admin/') && !path.startsWith('admin/')) {
      return true;
    }

    // Bypass en desarrollo si no hay token de autorización (para el admin-web)
    const authHeader = request.headers['authorization'];
    if (!authHeader && process.env.NODE_ENV !== 'production') {
      request.user = {
        id: 'a2000000-0000-0000-0000-000000000001', // Melo seeded admin user ID
        email: 'admin@equuscronos.com',
        role: 'ADMIN',
        tenantId: '',
      };
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('No autorizado. Token inválido o ausente.');
    }
    return user;
  }
}
