import { Component, Input } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { ProjetActifService } from '../service/projet-actif.service';
import { AuthService } from '../service/auth.service';
import { ProjetControllerService } from '../api/api/projetController.service';
import { NotificationService } from '../service/notification.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  @Input() isSidebarOpen: boolean = true;
  @Input() sidebarWidth: number = 280; // largeur ouverte (correspond à la nouvelle sidebar)
  @Input() sidebarClosedWidth: number = 75; // largeur fermée (correspond à la nouvelle sidebar)

  isAllVoyagesView: boolean = false;
  projetActif: any = null;
  currentProjet: any = null; // Projet actuellement consulté (peut être différent du projet actif)
  private loadingProjectDetails: boolean = false;
  notificationsCount: number = 0;

  constructor(
    private router: Router, 
    private projetActifService: ProjetActifService,
    private authService: AuthService,
    private projetControllerService: ProjetControllerService,
    private notificationService: NotificationService
  ) {
    this.subscribeStreams();
    this.subscribeToRouteChanges();
    // Initialiser compteur
    this.notificationService.getCountNonLuesAuto().subscribe(c => this.notificationsCount = c);
  }

  ngOnInit() { 
    this.updateView();
    // Forcer la mise à jour immédiate du projet actif
    this.projetActif = this.projetActifService.getProjetActif();
    
    // Vérifier la route actuelle pour initialiser currentProjet
    this.checkCurrentRoute();
  }

  private subscribeToRouteChanges() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.checkCurrentRoute();
    });
  }

  private checkCurrentRoute() {
    const url = this.router.url;
    // Détecter si on est sur une page de projet spécifique (ex: /projet/5/parametre)
    const projetMatch = url.match(/\/projet\/(\d+)/);
    
    if (projetMatch) {
      const projetId = parseInt(projetMatch[1]);
      // On est sur un projet spécifique, charger ses détails
      if (!this.currentProjet || this.currentProjet.id !== projetId) {
        this.loadProjectForDisplay(projetId);
      }
    } else {
      // On n'est pas sur un projet spécifique, réinitialiser currentProjet
      this.currentProjet = null;
    }
  }

  private loadProjectForDisplay(projetId: number) {
    if (this.loadingProjectDetails) return;
    this.loadingProjectDetails = true;
    
    this.projetControllerService.getProjetById(projetId, 'body').subscribe({
      next: async (data) => {
        let projet: any = null;
        
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            projet = JSON.parse(text);
          } catch (e) {
            console.error('Erreur parsing projet:', e);
            this.loadingProjectDetails = false;
            return;
          }
        } else {
          projet = data;
        }
        
        if (projet && projet.id) {
          this.currentProjet = projet;
        }
        this.loadingProjectDetails = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement du projet:', err);
        this.loadingProjectDetails = false;
      }
    });
  }

  private subscribeStreams() {
    this.projetActifService.projetActif$.subscribe(p => { 
      console.log('🔔 Navbar reçoit notification de projet actif:', p);
      
      // Ne pas écraser projetActif si p est null, un objet vide, ou un objet incomplet (sans nom)
      if (!p) {
        this.projetActif = null;
        console.log('❌ Projet actif mis à null');
      } else if (p && Object.keys(p).length > 0) {
        // Vérifier si l'objet a un nomNavire (projet complet)
        if (p.nomNavire || p.nomProduit) {
          // Projet complet, on met à jour
          this.projetActif = p;
          console.log('✅ Navbar - Projet actif mis à jour:', this.projetActif);
        } else if (p.id && !this.projetActif) {
          // Objet avec seulement ID et pas de projet actif existant
          // Accepter temporairement mais charger les détails
          this.projetActif = p;
          console.log('⚠️ Projet actif incomplet, chargement des détails...');
          this.loadProjectForDisplay(p.id);
        } else {
          // Objet incomplet et on a déjà un projet actif → ignorer
          console.warn('⚠️ Projet actif incomplet ignoré:', p, '- Garde l\'actuel:', this.projetActif);
        }
      }
    });
    this.projetActifService.viewMode$.subscribe(mode => { 
      this.isAllVoyagesView = mode;
      console.log('🔔 Navbar - Mode vue changé:', mode ? 'Tous les projets' : 'Projet spécifique');
    });
  }

  updateView() {
    this.projetActif = this.projetActifService.getProjetActif();
    this.isAllVoyagesView = this.projetActifService.getViewMode();
  }

  toggleViewMode() {
    if (this.isAllVoyagesView) {
      // On est en mode "tous les projets", on veut retourner au projet actif
      // Recharger le projet actif depuis le service pour s'assurer qu'il est à jour
      const projetActifActuel = this.projetActifService.getProjetActif();
      
      if (projetActifActuel && projetActifActuel.id) {
        this.projetActif = projetActifActuel;
        this.currentProjet = projetActifActuel; // Mettre à jour le projet consulté
        
        // 🔥 IMPORTANT : Mettre à jour le sessionStorage avec le projet actif
        window.sessionStorage.setItem('projetActifId', String(projetActifActuel.id));
        
        // Forcer la mise à jour du service pour déclencher les subscriptions
        this.projetActifService.setProjetActif(projetActifActuel);
        
        this.router.navigate(['/projet', projetActifActuel.id, 'parametre']);
        console.log('🔄 Retour au projet actif:', projetActifActuel);
      } else {
        // Si pas de projet actif, aller à la liste des projets
        console.warn('⚠️ Aucun projet actif trouvé');
        window.sessionStorage.removeItem('projetActifId');
        this.router.navigate(['/projet']);
      }
      this.projetActifService.setViewMode(false);
    } else {
      // On est en mode "projet actif", on veut voir tous les projets
      // Réinitialiser le projet consulté pour revenir au projet actif
      this.currentProjet = null;
      // 🔥 Nettoyer le sessionStorage pour éviter les conflits
      window.sessionStorage.removeItem('projetActifId');
      // Rediriger vers la page liste des projets
      this.router.navigate(['/projet']);
      this.projetActifService.setViewMode(true);
    }
  }

  getButtonText(): string {
    return this.isAllVoyagesView ? 'Vue Projet Actif' : 'Afficher tous les projets';
  }

  logout() {
    // Nettoyer les données spécifiques au projet
    try {
      this.projetActifService.clearProjetActif();
      this.projetActifService.setViewMode(false);
    } catch (e) { 
      console.warn('Erreur nettoyage storage projet', e); 
    }
    
    // Utiliser le service d'authentification pour une déconnexion complète
    this.authService.logout();
  }

  getProjectDisplay(): string { 
    // En mode "tous les projets" (isAllVoyagesView=true), afficher le projet actif
    // En mode "projet spécifique" (isAllVoyagesView=false), afficher currentProjet ou à défaut projetActif
    let projet: any;
    
    if (this.isAllVoyagesView) {
      // Mode "tous les projets" → Toujours afficher le projet actif
      projet = this.projetActif;
    } else {
      // Mode "projet spécifique" → Afficher le projet consulté, ou le projet actif si aucun projet consulté
      projet = this.currentProjet || this.projetActif;
    }
    
    // Si pas de projet, retourner message par défaut
    if (!projet) {
      return 'Aucun projet';
    }
    
    // Format: "Navire - Date début"
    const navire = projet.nomNavire || 'Sans navire';
    const dateDebut = projet.dateDebut ? this.formatDate(projet.dateDebut) : 'Sans date';
    
    return `${navire} - ${dateDebut}`;
  }
  
  // Méthode pour formater la date (YYYY-MM-DD -> DD/MM/YYYY)
  private formatDate(dateStr: string): string {
    if (!dateStr) return 'Sans date';
    
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  }
}
