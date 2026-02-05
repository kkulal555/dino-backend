import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization Header');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Basic' || !token) {
      throw new UnauthorizedException('Invalid Authorization Type');
    }

    const decoded = Buffer.from(token, 'base64').toString('ascii');
    const [username, password] = decoded.split(':');

    const validUser = this.configService.get<string>('AUTH_USER');
    const validPass = this.configService.get<string>('AUTH_PASS');

    if (username === validUser && password === validPass) {
      return true;
    }

    throw new UnauthorizedException('Invalid Credentials');
  }
}
