import { Component } from '@angular/core';
import { DepotControllerService } from '../../api/api/depotController.service';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { HttpClient } from '@angular/common/http';
import { Inject } from '@angular/core';
import { BASE_PATH } from '../../api/variables';
import { ProjetActifService } from '../../service/projet-actif.service';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { DepotDTO } from '../../api/model/depotDTO';
import { VoyageDTO } from '../../api/model/voyageDTO';
import { BreadcrumbItem } from '../breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-depot',
  templateUrl: './depot.component.html',
  styleUrls: ['./depot.component.css']
})
export class DepotComponent {
  depots: DepotDTO[] = [];
  filteredDepots: DepotDTO[] = [];
  paginatedDepots: DepotDTO[] = [];
  // Global active project
  projetActifId: number | null = null;
  projetActif: any = null;
  // Context (visited) project from session
  contextProjetId: number | null = null;
  contextProjet: any = null;
  breadcrumbItems: BreadcrumbItem[] = [];
  selectedDepot: DepotDTO | null = null;
  dialogDepot: DepotDTO = { nom: '' };
  editMode: boolean = false;
  error: string = '';
  isSidebarOpen: boolean = true;
  showAddDialog: boolean = false;
  depotFilter: string = '';
  
  // Pour l'autocomplétion type Select2
  allDepots: DepotDTO[] = []; // Tous les dépôts (toutes les BDD)
  filteredSuggestions: DepotDTO[] = [];
  showSuggestions: boolean = false;
  selectedExistingDepot: DepotDTO | null = null;
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageSizes: number[] = [5, 10, 20, 50];
  
  // Tri
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Voyages pour calculer la quantité vendue
  voyages: VoyageDTO[] = [];
  
  // Date Filter
  dateFilterActive: boolean = false;
  selectedDate: string | null = null;
  
  Math = Math;

  constructor(
    private depotService: DepotControllerService, 
    private voyageService: VoyageControllerService,
    private projetActifService: ProjetActifService, 
    private projetService: ProjetControllerService, 
    private http: HttpClient, 
    @Inject(BASE_PATH) private basePath: string
  ) {
    // 🔥 Écouter les changements du projet actif
    this.projetActifService.projetActif$.subscribe(projet => {
      console.log('📡 [Depot] Notification reçue - Nouveau projet:', projet);
      
      if (projet && projet.id) {
        const previousId = this.projetActifId;
        this.projetActifId = projet.id;
        this.projetActif = projet;
        
        // 🔥 FIX : Recharger si le projet change OU si c'est la première fois
        if (!previousId || previousId !== projet.id) {
          console.log('🔄 [Depot] Rechargement - previousId:', previousId, 'newId:', projet.id);
          setTimeout(() => {
            this.reloadData();
          }, 50);
        }
      }
    });
    
    this.initializeProjetContext();
  }

  initializeProjetContext() {
    const globalProjet = this.projetActifService.getProjetActif?.();
    if (globalProjet && globalProjet.id) {
      this.projetActifId = globalProjet.id;
      this.projetActif = globalProjet;
    }
    const contextId = window.sessionStorage.getItem('projetActifId');
    if (contextId) {
      this.contextProjetId = Number(contextId);
      this.loadProjetDetails(this.contextProjetId, true);
    }
    this.loadAllDepots(); // Charger tous les dépôts pour l'autocomplétion
    this.loadDepots();
    this.loadVoyages(); // Charger les voyages pour calculer la quantité vendue
  }

  // 🔥 NOUVEAU : Méthode pour recharger toutes les données
  reloadData() {
    // Réinitialiser le contexte si on n'est pas sur une page de paramètre
    const contextId = window.sessionStorage.getItem('projetActifId');
    if (contextId) {
      this.contextProjetId = Number(contextId);
      this.loadProjetDetails(this.contextProjetId, true);
    } else {
      this.contextProjetId = null;
      this.contextProjet = null;
    }
    
    // Recharger toutes les données
    this.loadAllDepots();
    this.loadDepots();
    this.loadVoyages();
    this.updateBreadcrumb();
  }

  loadProjetDetails(projetId: number, isContext: boolean = false) {
    this.projetService.getProjetById(projetId, 'body').subscribe({
      next: async (data: any) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const parsed = JSON.parse(text);
            if (isContext) {
              this.contextProjet = parsed;
              this.updateBreadcrumb();
            } else {
              this.projetActif = parsed;
            }
          } catch (e) {
            console.error('Erreur parsing projet:', e);
          }
        } else {
          if (isContext) {
            this.contextProjet = data;
            this.updateBreadcrumb();
          } else {
            this.projetActif = data;
          }
        }
      },
      error: (err: any) => {
        console.error('Erreur chargement projet:', err);
      }
    });
  }

  // IMPORTANT: Cette méthode est pour FILTRER les données (garde le comportement actuel)
  isProjetActif(): boolean {
    // Pour filtrage on utilise le contexte si disponible, sinon global
    return !!(this.contextProjetId || this.projetActifId);
  }

  // NOUVELLE: Cette méthode est UNIQUEMENT pour les boutons Ajouter
  canAddData(): boolean {
    // Si on visite un autre projet, on contrôle selon ce projet contextuel
    if (this.contextProjet) {
      return this.contextProjet.active === true;
    }
    return !!(this.projetActif && this.projetActif.active === true);
  }

  updateBreadcrumb() {
    const projet = this.contextProjet || this.projetActif;
    if (projet) {
      this.breadcrumbItems = [
        { label: 'Projets', url: '/projet' },
        { label: projet.nom || `Projet ${projet.id}`, url: `/projet/${projet.id}/parametre` },
        { label: 'Param\u00e8tres', url: `/projet/${projet.id}/parametre` },
        { label: 'D\u00e9p\u00f4ts' }
      ];
    } else {
      this.breadcrumbItems = [
        { label: 'D\u00e9p\u00f4ts' }
      ];
    }
  }

  openAddDialog() {
    this.dialogDepot = { nom: '' };
    this.selectedExistingDepot = null;
    this.showAddDialog = true;
    this.editMode = false;
    this.showSuggestions = false;
    this.filteredSuggestions = [];
  }

  // Charger tous les dépôts de la base de données pour l'autocomplétion
  loadAllDepots() {
    this.depotService.getAllDepots('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              this.allDepots = json;
            }
          } catch (e) {
            console.error('Erreur parsing allDepots:', e);
          }
        } else if (Array.isArray(data)) {
          this.allDepots = data;
        }
        console.log('AllDepots chargés pour autocomplétion:', this.allDepots.length);
      },
      error: (err) => {
        console.error('Erreur chargement allDepots:', err);
      }
    });
  }

  // Filtrer les suggestions lors de la saisie
  onDepotInputChange() {
    const searchValue = this.dialogDepot.nom;
    
    if (!searchValue || searchValue.trim().length < 2) {
      this.showSuggestions = false;
      this.filteredSuggestions = [];
      this.selectedExistingDepot = null;
      return;
    }
    
    const searchLower = searchValue.trim().toLowerCase();
    const targetProjetId = this.contextProjetId || this.projetActifId;
    
    // Filtrer les dépôts qui correspondent et qui ne sont PAS déjà dans le projet actuel
    this.filteredSuggestions = this.allDepots.filter(depot => {
      const matchesSearch = depot.nom?.toLowerCase().includes(searchLower);
      // Exclure les dépôts déjà associés au projet actuel
      const notInCurrentProject = !this.depots.some(d => d.id === depot.id);
      return matchesSearch && notInCurrentProject;
    }).slice(0, 10); // Limiter à 10 suggestions
    
    this.showSuggestions = this.filteredSuggestions.length > 0;
    this.selectedExistingDepot = null;
  }

  // Sélectionner un dépôt existant depuis les suggestions
  selectSuggestion(depot: DepotDTO) {
    this.selectedExistingDepot = depot;
    this.dialogDepot.nom = depot.nom || '';
    this.showSuggestions = false;
    this.filteredSuggestions = [];
  }

  // Fermer les suggestions si on clique ailleurs
  closeSuggestions() {
    setTimeout(() => {
      this.showSuggestions = false;
      this.filteredSuggestions = [];
    }, 200);
  }

  selectDepot(dep: DepotDTO) {
    this.dialogDepot = { ...dep };
    this.selectedDepot = dep;
    this.editMode = true;
    this.showAddDialog = false;
  }

  addDialogDepot() {
    if (!this.dialogDepot.nom) {
      this.error = 'Veuillez remplir le nom.';
      return;
    }
    
    const targetProjetId = this.contextProjetId || this.projetActifId;
    
    // Si un dépôt existant a été sélectionné, on l'associe simplement au projet
    if (this.selectedExistingDepot && this.selectedExistingDepot.id) {
      console.log('Association dépôt existant:', this.selectedExistingDepot.id, 'au projet:', targetProjetId);
      if (targetProjetId) {
        this.projetService.addDepotToProjet(targetProjetId, this.selectedExistingDepot.id).subscribe({
          next: () => {
            console.log('Dépôt existant associé au projet');
            this.loadDepots();
            this.closeDialog();
          },
          error: (err) => {
            this.error = 'Erreur association dépôt: ' + (err.error?.message || err.message);
            console.error('Erreur association dépôt existant:', err);
          }
        });
      }
      return;
    }
    
    // Sinon, créer un nouveau dépôt
    if (targetProjetId) {
      this.dialogDepot.projetId = targetProjetId;
    }

    console.log('Création nouveau depot - payload:', this.dialogDepot);

    this.depotService.createDepot(this.dialogDepot, 'body').subscribe({
      next: (created) => {
  // Log raw response
  console.log('Réponse création depot (raw):', created);

        // If backend returns Blob, parse it to extract created depot and id
        if (created instanceof Blob) {
          created.text().then(text => {
            try {
              const parsed = JSON.parse(text);
              console.log('Réponse création depot (parsed):', parsed);
              const parsedId = parsed?.id;
              console.log('Parsed created depot id from Blob:', parsedId);
              const associateProjetId = this.contextProjetId || this.projetActifId;
              if (associateProjetId && parsedId) {
                this.projetService.addDepotToProjet(associateProjetId, parsedId).subscribe({
                  next: () => {
                    console.log('Depot associé au projet (via Blob)');
                    this.loadDepots();
                  },
                  error: (err) => {
                    console.error('Erreur association depot-projet (via Blob):', err);
                    this.loadDepots();
                  }
                });
              } else {
                this.loadDepots();
              }
            } catch (e) {
              console.error('Erreur parsing création depot:', e);
              this.loadDepots();
            }
          }).catch(e => {
            console.error('Erreur lecture Blob création depot:', e);
            this.loadDepots();
          });
        } else {
          console.log('Depot créé:', created);
          const createdId = (created as any)?.id;
          const associateProjetId = this.contextProjetId || this.projetActifId;
          if (associateProjetId && createdId) {
            this.projetService.addDepotToProjet(associateProjetId, createdId).subscribe({
              next: () => {
                console.log('Depot associé (json) au projet');
                this.loadDepots();
              },
              error: (err) => {
                console.error('Erreur association depot-projet (json):', err);
                this.loadDepots();
              }
            });
          } else {
            this.loadDepots();
          }
        }

        this.dialogDepot = { nom: '' };
        this.closeDialog();
      },
      error: (err) => {
        this.error = 'Erreur ajout: ' + (err.error?.message || err.message);
        console.error('Erreur création depot:', err);
      }
    });
  }

  updateDialogDepot() {
    if (!this.dialogDepot?.id) return;
    this.depotService.createDepot(this.dialogDepot, 'body').subscribe({
      next: () => {
        this.dialogDepot = { nom: '' };
        this.selectedDepot = null;
        this.editMode = false;
        this.loadDepots();
        this.closeDialog();
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
  }

  closeDialog() {
    this.showAddDialog = false;
    this.editMode = false;
    this.dialogDepot = { nom: '' };
    this.selectedDepot = null;
    this.error = '';
  }

  applyFilter() {
    const filter = this.depotFilter.trim().toLowerCase();
    let depotsFiltrés = this.depots;
    
    // Filtre par projet actif - similaire au composant client
    const targetProjetId = this.contextProjetId || this.projetActifId;
    if (targetProjetId) {
      // Filtrer uniquement les dépôts qui appartiennent au projet ciblé
      depotsFiltrés = depotsFiltrés.filter(d => d.projetId === targetProjetId);
      console.log(`applyFilter() - Filtrage pour projet ${targetProjetId}:`, {
        total: this.depots.length,
        filtrés: depotsFiltrés.length,
        dépôts: depotsFiltrés
      });
    }
    
    // Filtre par texte
    if (filter) {
      depotsFiltrés = depotsFiltrés.filter(d =>
        d.nom?.toLowerCase().includes(filter)
      );
    }
    
    this.filteredDepots = depotsFiltrés;
    this.updatePagination();
  }
  
  sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortDepots();
  }
  
  sortDepots() {
    if (!this.sortColumn) {
      this.updatePagination();
      return;
    }
    
    this.filteredDepots.sort((a, b) => {
      let aVal: any = a[this.sortColumn as keyof DepotDTO];
      let bVal: any = b[this.sortColumn as keyof DepotDTO];
      
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    this.updatePagination();
  }
  
  updatePagination() {
    this.totalPages = Math.ceil(this.filteredDepots.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedDepots = this.filteredDepots.slice(startIndex, endIndex);
  }
  
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }
  
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }
  
  onPageSizeChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  deleteDepot(id?: number) {
    if (id === undefined) return;
    this.depotService.deleteDepot(id, 'body').subscribe({
      next: () => {
        this.loadDepots();
      },
      error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
    });
  }

  loadDepots() {
    const targetProjetId = this.contextProjetId || this.projetActifId;
    console.log('📊 loadDepots() - contextProjetId:', this.contextProjetId, 'projetActifId:', this.projetActifId, 'targetProjetId:', targetProjetId);
    
    if (!targetProjetId) {
      console.warn('⚠️ Aucun projet actif - liste des dépôts vide');
      this.depots = [];
      this.applyFilter();
      return;
    }
    
    // TOUJOURS charger via l'endpoint spécifique au projet pour garantir le filtrage
    const url = `${this.basePath}/api/projets/${targetProjetId}/depots`;
    console.log('📤 Appel endpoint projet-dépôts:', url);
    
    this.http.get<any[]>(url, { withCredentials: true, responseType: 'json' as 'json' }).subscribe({
      next: (data) => {
        console.log('✅ Réponse getDepotsByProjet:', data);
        if (Array.isArray(data)) {
          this.depots = data;
          console.log(`✅ ${data.length} dépôts chargés pour le projet ${targetProjetId}`);
        } else {
          this.depots = [];
          console.warn('⚠️ Réponse non-array:', data);
        }
        this.applyFilter();
      },
      error: err => {
        console.error('❌ Erreur chargement dépôts pour projet:', err);
        this.error = 'Erreur chargement des dépôts: ' + (err.error?.message || err.message);
        this.depots = [];
        this.applyFilter();
      }
    });
  }

  // Charger les voyages
  loadVoyages() {
    const targetProjetId = this.contextProjetId || this.projetActifId;
    
    if (targetProjetId) {
      // Charger les voyages du projet
      this.voyageService.getVoyagesByProjet(targetProjetId, 'body').subscribe({
        next: async (data: any) => {
          if (data instanceof Blob) {
            const text = await data.text();
            try {
              const parsed = JSON.parse(text);
              this.voyages = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              console.error('Erreur parsing voyages:', e);
              this.voyages = [];
            }
          } else {
            this.voyages = Array.isArray(data) ? data : [];
          }
        },
        error: (err: any) => {
          console.error('Erreur chargement voyages:', err);
          this.voyages = [];
        }
      });
    } else {
      // Charger tous les voyages
      this.voyageService.getAllVoyages('body').subscribe({
        next: async (data: any) => {
          if (data instanceof Blob) {
            const text = await data.text();
            try {
              const parsed = JSON.parse(text);
              this.voyages = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              console.error('Erreur parsing voyages:', e);
              this.voyages = [];
            }
          } else {
            this.voyages = Array.isArray(data) ? data : [];
          }
        },
        error: (err: any) => {
          console.error('Erreur chargement voyages:', err);
          this.voyages = [];
        }
      });
    }
  }

  // Calculer la quantité totale livrée au dépôt
  getTotalLivreDepot(depotId: number | undefined): number {
    if (!depotId) return 0;
    
    let voyagesDepot = this.voyages.filter(v => v.depotId === depotId && v.poidsDepot);
    
    // Appliquer le filtre par date si actif - calcul cumulatif avec journée 7h-7h
    if (this.dateFilterActive && this.selectedDate) {
      // Date limite : fin de la journée de travail = 7h du lendemain
      const selectedDateObj = new Date(this.selectedDate + 'T00:00:00');
      const endWorkDay = new Date(selectedDateObj);
      endWorkDay.setDate(endWorkDay.getDate() + 1);
      endWorkDay.setHours(7, 0, 0, 0); // 7h00 du lendemain = fin de la journée du jour sélectionné
      
      voyagesDepot = voyagesDepot.filter(v => {
        if (!v.date) return false;
        const voyageDateTime = new Date(v.date);
        // Inclure tous les voyages AVANT la fin de la journée sélectionnée
        return voyageDateTime < endWorkDay;
      });
    }
    
    return voyagesDepot.reduce((sum, v) => sum + (v.poidsDepot || 0), 0);
  }

  // Gestion du filtre par date
  toggleDateFilter() {
    this.dateFilterActive = !this.dateFilterActive;
    if (!this.dateFilterActive) {
      this.selectedDate = null;
    }
  }

  onDateFilterChange() {
    // Le filtre est automatiquement appliqué via getTotalLivreDepot
    this.updatePagination();
  }

  clearDateFilter() {
    this.dateFilterActive = false;
    this.selectedDate = null;
    this.updatePagination();
  }

  formatDate(date: string | null): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}
