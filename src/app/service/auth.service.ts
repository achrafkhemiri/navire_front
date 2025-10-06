import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'authLoggedIn';
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$: Observable<boolean> = this.isAuthenticatedSubject.asObservable();

  constructor(private router: Router) {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    this.isAuthenticatedSubject.next(stored === 'true');
  }

  /**
   * Retourne true si l'utilisateur est authentifié
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Marque l'utilisateur comme connecté
   */
  markLoggedIn(): void {
    localStorage.setItem(this.STORAGE_KEY, 'true');
    this.isAuthenticatedSubject.next(true);
  }

  /**
   * Marque l'utilisateur comme déconnecté
   */
  markLoggedOut(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.isAuthenticatedSubject.next(false);
  }

  /**
   * Déconnecte l'utilisateur et le redirige vers /login
   */
  logout(): void {
    this.markLoggedOut();
    this.clearLocalData();
    this.router.navigate(['/login']);
  }

  /**
   * Nettoie les données locales
   */
  private clearLocalData(): void {
    try {
      localStorage.removeItem('projetActif');
      localStorage.removeItem('viewMode');
      localStorage.removeItem('isAllVoyagesView');
      sessionStorage.removeItem('projetActifId');
    } catch {}
  }
}