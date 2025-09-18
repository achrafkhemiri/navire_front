import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformServer } from '@angular/common';
import { REQUEST } from '@nguniversal/express-engine/tokens';

@Injectable()
export class SsrJwtInterceptor implements HttpInterceptor {
  constructor(@Inject(PLATFORM_ID) private platformId: Object,
              @Inject(REQUEST) private request: any) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (isPlatformServer(this.platformId)) {
      // Récupère le cookie JWT côté serveur
      const cookies = this.request.headers?.cookie;
      if (cookies) {
        const jwtMatch = cookies.match(/jwt=([^;]+)/);
        if (jwtMatch) {
          // Ajoute le JWT dans l'en-tête Authorization
          const cloned = req.clone({
            setHeaders: {
              Authorization: `Bearer ${jwtMatch[1]}`
            }
          });
          return next.handle(cloned);
        }
      }
    }
    return next.handle(req);
  }
}
