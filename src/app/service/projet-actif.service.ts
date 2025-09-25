import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ProjetActifService {
  private readonly STORAGE_KEY = 'projetActif';
  private projetActif: any = null;

  setProjetActif(projet: any) {
    this.projetActif = projet;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projet));
  }

  getProjetActif() {
    if (this.projetActif) return this.projetActif;
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      this.projetActif = JSON.parse(stored);
      return this.projetActif;
    }
    return null;
  }

  clearProjetActif() {
    this.projetActif = null;
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
