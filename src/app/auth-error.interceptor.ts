import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './service/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthErrorInterceptor implements HttpInterceptor {
  private isHandlingExpiration = false;
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: any) => {
        if (error instanceof HttpErrorResponse) {
          // Gérer les erreurs 401 - Token invalide ou expiré
          if (error.status === 401) {
            console.warn('🔒 Token expiré ou invalide (401). Déconnexion automatique...');
            this.handleTokenExpiration();
          }
          
          // Gérer les erreurs 403 liées au token expiré
          if (error.status === 403) {
            const errorMessage = error.error?.message?.toLowerCase() || '';
            const errorText = error.message?.toLowerCase() || '';
            const urlPath = error.url || '';
            
            // Ignorer les erreurs 403 sur les notifications POST (création)
            // car ce ne sont pas des opérations critiques d'authentification
            if (urlPath.includes('/api/notifications') && req.method === 'POST') {
              console.warn('⚠️ Échec création notification (403) - ignoré pour éviter déconnexion intempestive');
              return throwError(() => error);
            }
            
            // Si l'utilisateur est censé être authentifié mais reçoit un 403,
            // c'est probablement dû à un token expiré
            if (this.authService.isAuthenticated()) {
              console.warn('🔒 Erreur 403 reçue alors que l\'utilisateur est authentifié. Token probablement expiré. Déconnexion automatique...');
              console.log('URL de la requête:', urlPath);
              console.log('Message d\'erreur:', errorMessage || errorText || '(vide)');
              this.handleTokenExpiration();
            } else {
              // Vérifier si c'est explicitement lié à un problème d'authentification
              if (errorMessage.includes('token') || 
                  errorMessage.includes('expired') || 
                  errorMessage.includes('jwt') ||
                  errorMessage.includes('unauthorized') ||
                  errorText.includes('token') ||
                  errorText.includes('expired')) {
                console.warn('🔒 Problème d\'authentification détecté (403). Déconnexion automatique...');
                this.handleTokenExpiration();
              }
            }
          }
        }
        return throwError(() => error);
      })
    );
  }

  private handleTokenExpiration(): void {
    // Éviter les appels multiples simultanés
    if (this.isHandlingExpiration) {
      console.log('⏭️ Déconnexion déjà en cours, ignoré...');
      return;
    }
    
    this.isHandlingExpiration = true;
    console.log('🚪 Déconnexion de l\'utilisateur...');
    
    // Marquer comme déconnecté immédiatement
    this.authService.markLoggedOut();
    
    // Nettoyer les données locales
    try {
      localStorage.removeItem('projetActif');
      localStorage.removeItem('viewMode');
      localStorage.removeItem('isAllVoyagesView');
      localStorage.removeItem('isAuthenticated');
      sessionStorage.removeItem('projetActifId');
    } catch {}
    
    // Supprimer le cookie JWT
    if (typeof document !== 'undefined') {
      document.cookie = 'jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
    
    // Rediriger vers la page de connexion avec paramètre d'expiration
    setTimeout(() => {
      this.isHandlingExpiration = false;
      if (!this.router.url.includes('/login')) {
        console.log('↪️ Redirection vers /login avec message d\'expiration');
        this.router.navigate(['/login'], { 
          queryParams: { 
            expired: 'true'
          } 
        });
      } else {
        console.log('↪️ Déjà sur la page de login');
      }
    }, 100);
  }
}
