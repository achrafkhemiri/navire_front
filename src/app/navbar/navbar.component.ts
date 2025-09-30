import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ProjetActifService } from '../service/projet-actif.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  @Input() isSidebarOpen: boolean = true;
  @Input() sidebarWidth: number = 220; // largeur ouverte
  @Input() sidebarClosedWidth: number = 70; // largeur fermée

  isAllVoyagesView: boolean = false;
  projetActif: any = null;

  constructor(private router: Router, private projetActifService: ProjetActifService) {
    this.subscribeStreams();
  }

  ngOnInit() { this.updateView(); }

  private subscribeStreams() {
    this.projetActifService.projetActif$.subscribe(p => { this.projetActif = p; });
    this.projetActifService.viewMode$.subscribe(mode => { this.isAllVoyagesView = mode; });
  }

  updateView() {
    this.projetActif = this.projetActifService.getProjetActif();
    this.isAllVoyagesView = this.projetActifService.getViewMode();
  }

  toggleViewMode() {
    this.projetActifService.setViewMode(!this.isAllVoyagesView);
  }

  getButtonText(): string {
    return this.isAllVoyagesView ? 'Vue Projet Actif' : 'Afficher tous les projets';
  }

  logout() {
    try {
      this.projetActifService.clearProjetActif();
      this.projetActifService.setViewMode(false);
      localStorage.removeItem('isAllVoyagesView');
      sessionStorage.removeItem('projetActifId');
    } catch (e) { console.warn('Erreur nettoyage storage', e); }
    this.router.navigate(['/login']);
  }

  getProjectDisplay(): string { return this.projetActif?.nom ? `${this.projetActif.nom}` : 'Projet'; }
}
