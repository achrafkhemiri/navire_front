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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
  dialogDepot: DepotDTO = { nom: '', adresse: '', mf: '' };
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
  dateDebut: string | null = null;
  dateFin: string | null = null;
  // Date max pour le filtre (aujourd'hui)
  today: string = '';
  
  // Modal de confirmation/erreur
  showConfirmModal: boolean = false;
  showErrorModal: boolean = false;
  modalTitle: string = '';
  modalMessage: string = '';
  modalIcon: string = '';
  modalIconColor: string = '';
  depotToDelete: number | null = null;
  
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
    // Initialiser la date du jour
    this.today = this.getTodayString();
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
    this.dialogDepot = { nom: '', adresse: '', mf: '' };
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
              // Trier par ID décroissant (du plus récent au plus ancien)
              this.allDepots = json.sort((a, b) => (b.id || 0) - (a.id || 0));
            }
          } catch (e) {
            console.error('Erreur parsing allDepots:', e);
          }
        } else if (Array.isArray(data)) {
          // Trier par ID décroissant (du plus récent au plus ancien)
          this.allDepots = data.sort((a, b) => (b.id || 0) - (a.id || 0));
        }
        console.log('AllDepots chargés et triés pour autocomplétion:', this.allDepots.length);
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
    this.dialogDepot.adresse = depot.adresse || '';
    this.dialogDepot.mf = depot.mf || '';
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
    this.dialogDepot = { 
      id: dep.id,
      nom: dep.nom,
      adresse: dep.adresse,
      mf: dep.mf,
      projetId: dep.projetId
    };
    this.selectedDepot = dep;
    this.editMode = true;
    this.showAddDialog = true;
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
    console.log('dialogDepot.nom:', this.dialogDepot.nom);
    console.log('dialogDepot.adresse:', this.dialogDepot.adresse);
    console.log('dialogDepot.mf:', this.dialogDepot.mf);

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

        this.dialogDepot = { nom: '', adresse: '', mf: '' };
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
    this.depotService.updateDepot(this.dialogDepot.id, this.dialogDepot, 'body').subscribe({
      next: () => {
        this.dialogDepot = { nom: '', adresse: '', mf: '' };
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
    this.dialogDepot = { nom: '', adresse: '', mf: '' };
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

  // Total livré pour un dépôt avec filtre par plage de dates (journée de travail 7h00 → 6h00)
  getTotalLivreDepot(depotId?: number): number {
    if (!depotId || !this.voyages) return 0;
    let voyagesFiltrés = this.voyages.filter(v => v.depotId === depotId && v.poidsDepot);

    if (this.dateFilterActive && (this.dateDebut || this.dateFin)) {
      const startDate = this.dateDebut ? new Date(this.dateDebut + 'T00:00:00') : new Date('1900-01-01');
      const endDate = this.dateFin ? new Date(this.dateFin + 'T00:00:00') : new Date();
      
      voyagesFiltrés = voyagesFiltrés.filter(v => {
        if (!v.date) return false;
        const voyageDateTime = new Date(v.date);
        
        // Vérifier si le voyage tombe dans l'une des journées de travail de la plage
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const workDayStart = new Date(d);
          workDayStart.setHours(7, 0, 0, 0);
          const workDayEnd = new Date(d);
          workDayEnd.setDate(workDayEnd.getDate() + 1);
          workDayEnd.setHours(6, 0, 0, 0);
          
          if (voyageDateTime >= workDayStart && voyageDateTime < workDayEnd) {
            return true;
          }
        }
        return false;
      });
    }
    return voyagesFiltrés.reduce((sum, v) => sum + (v.poidsDepot || 0), 0);
  }

  toggleDateFilter() {
    this.dateFilterActive = !this.dateFilterActive;
    this.updatePagination();
  }

  onDateFilterChange() {
    // Empêcher la sélection d'une date future
    if (this.dateDebut && this.today && this.dateDebut > this.today) {
      this.dateDebut = this.today;
    }
    if (this.dateFin && this.today && this.dateFin > this.today) {
      this.dateFin = this.today;
    }
    this.updatePagination();
  }

  clearDateFilter() {
    this.dateFilterActive = false;
    this.dateDebut = null;
    this.dateFin = null;
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
    
    // Vérifier si le dépôt a une quantité vendue > 0
    const quantite = this.getTotalLivreDepot(id);
    if (quantite > 0) {
      this.showErrorModal = true;
      this.modalTitle = 'Suppression impossible';
      this.modalMessage = `Ce dépôt a une quantité vendue de ${quantite.toFixed(2)} kg. Vous ne pouvez pas supprimer un dépôt ayant des ventes enregistrées.`;
      this.modalIcon = 'bi-exclamation-triangle-fill';
      this.modalIconColor = '#ef4444';
      return;
    }
    
    // Afficher la modale de confirmation
    this.depotToDelete = id;
    this.showConfirmModal = true;
    this.modalTitle = 'Confirmer la suppression';
    this.modalMessage = 'Êtes-vous sûr de vouloir supprimer ce dépôt ? Cette action est irréversible.';
    this.modalIcon = 'bi-trash-fill';
    this.modalIconColor = '#ef4444';
  }

  confirmDelete() {
    if (this.depotToDelete === null) return;
    
    const targetProjetId = this.contextProjetId || this.projetActifId;
    if (!targetProjetId) {
      this.showConfirmModal = false;
      this.showErrorModal = true;
      this.modalTitle = 'Erreur';
      this.modalMessage = 'Aucun projet actif';
      this.modalIcon = 'bi-x-circle-fill';
      this.modalIconColor = '#ef4444';
      return;
    }
    
    // Utiliser depotService.deleteDepot qui utilise la bonne méthode backend
    this.depotService.deleteDepot(this.depotToDelete, 'body').subscribe({
      next: () => {
        console.log('✅ Dépôt supprimé avec succès');
        this.showConfirmModal = false;
        this.depotToDelete = null;
        this.loadDepots();
      },
      error: (err) => {
        console.error('❌ Erreur suppression dépôt:', err);
        this.showConfirmModal = false;
        this.showErrorModal = true;
        this.modalTitle = 'Erreur de suppression';
        
        // Message d'erreur plus explicite
        let errorMessage = 'Une erreur est survenue lors de la suppression';
        
        if (err.status === 403) {
          errorMessage = 'Vous n\'avez pas les permissions nécessaires pour supprimer ce dépôt.';
        } else if (err.error?.message) {
          errorMessage = err.error.message;
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        // Détecter les erreurs de contrainte de clé étrangère
        const errorText = JSON.stringify(err);
        if (errorText.includes('foreign key') || errorText.includes('constraint') || errorText.includes('DataIntegrityViolationException')) {
          errorMessage = 'Ce dépôt est encore associé à un ou plusieurs projets. Il ne peut pas être supprimé tant qu\'il y a des associations actives.';
        }
        
        this.modalMessage = errorMessage;
        this.modalIcon = 'bi-x-circle-fill';
        this.modalIconColor = '#ef4444';
      }
    });
  }

  cancelDelete() {
    this.showConfirmModal = false;
    this.depotToDelete = null;
  }

  closeErrorModal() {
    this.showErrorModal = false;
    this.modalTitle = '';
    this.modalMessage = '';
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
          // Trier par ID décroissant (du plus récent au plus ancien)
          this.depots = data.sort((a, b) => (b.id || 0) - (a.id || 0));
          console.log(`✅ ${data.length} dépôts chargés et triés pour le projet ${targetProjetId}`);
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

  // Calcul cumulé legacy supprimé: méthodes remplacées par version fenêtre [07:00, 06:00)

  formatDate(date: string | null): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Helper: retourne aujourd'hui au format yyyy-MM-dd (heure locale)
  private getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Export PDF
  exportToPDF(): void {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Titre
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Liste des Dépôts', 14, 15);

    // Informations du projet
    if (this.projetActif) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      let yPos = 25;
      
      if (this.projetActif.nomNavire) {
        doc.text(`Navire: ${this.projetActif.nomNavire}`, 14, yPos);
        yPos += 6;
      }
      if (this.projetActif.port) {
        doc.text(`Port: ${this.projetActif.port}`, 14, yPos);
        yPos += 6;
      }
      if (this.projetActif.nomProduit) {
        doc.text(`Produit: ${this.projetActif.nomProduit}`, 14, yPos);
        yPos += 6;
      }
    }

    // Statistiques
    const totalDepots = this.filteredDepots.length;
    const totalVendu = this.filteredDepots.reduce((sum, d) => 
      sum + (this.getTotalLivreDepot(d.id) || 0), 0
    );

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    let statsY = this.projetActif ? 45 : 25;
    doc.text(`Total Dépôts: ${totalDepots}`, 14, statsY);
    doc.text(`Quantité Totale Vendue: ${totalVendu.toFixed(2)} kg`, 80, statsY);

    // Filtres appliqués
    // Filtres appliqués
    if (this.dateFilterActive && (this.dateDebut || this.dateFin)) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      statsY += 6;
      let filterText = 'Filtre par date: ';
      if (this.dateDebut && this.dateFin) {
        filterText += `${this.formatDate(this.dateDebut)} - ${this.formatDate(this.dateFin)}`;
      } else if (this.dateDebut) {
        filterText += `À partir du ${this.formatDate(this.dateDebut)}`;
      } else if (this.dateFin) {
        filterText += `Jusqu'au ${this.formatDate(this.dateFin)}`;
      }
      doc.text(filterText, 14, statsY);
    }

    // Préparer les données du tableau
    const tableData = this.filteredDepots.map(depot => {
      const quantiteVendue = this.getTotalLivreDepot(depot.id);
      
      return [
        depot.nom || '-',
        depot.adresse || '-',
        depot.mf || '-',
        quantiteVendue.toFixed(2)
      ];
    });

    // Générer le tableau
    autoTable(doc, {
      startY: statsY + 10,
      head: [['Nom', 'Adresse', 'Matricule Fiscal', 'Quantité Vendue (kg)']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [251, 191, 36], // Couleur jaune/orange pour les dépôts
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 10
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 80 },
        2: { cellWidth: 50 },
        3: { cellWidth: 40, halign: 'right' }
      },
      didDrawPage: (data) => {
        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Page ${data.pageNumber} / ${pageCount} - Généré le ${new Date().toLocaleDateString('fr-FR')}`,
          14,
          pageHeight - 10
        );
      }
    });

    // Télécharger le PDF
    const fileName = `Depots_${this.projetActif?.nomNavire || 'Liste'}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`;
    doc.save(fileName);
  }

  // Export Excel
  exportToExcel(): void {
    // Préparer les données
    const data = this.filteredDepots.map(depot => {
      const quantiteVendue = this.getTotalLivreDepot(depot.id);
      
      return {
        'Nom': depot.nom || '-',
        'Adresse': depot.adresse || '-',
        'Matricule Fiscal': depot.mf || '-',
        'Quantité Vendue (kg)': quantiteVendue.toFixed(2)
      };
    });

    // Créer la feuille de calcul
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);

    // Définir la largeur des colonnes
    ws['!cols'] = [
      { wch: 30 }, // Nom
      { wch: 50 }, // Adresse
      { wch: 25 }, // MF
      { wch: 20 }  // Quantité Vendue
    ];

    // Créer le classeur
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dépôts');

    // Ajouter une feuille de statistiques
    const totalDepots = this.filteredDepots.length;
    const totalVendu = this.filteredDepots.reduce((sum, d) => 
      sum + (this.getTotalLivreDepot(d.id) || 0), 0
    );

    const statsData = [
      { 'Statistique': 'Total Dépôts', 'Valeur': totalDepots },
      { 'Statistique': 'Quantité Totale Vendue (kg)', 'Valeur': totalVendu.toFixed(2) }
    ];

    if (this.projetActif) {
      statsData.unshift(
        { 'Statistique': 'Navire', 'Valeur': this.projetActif.nomNavire || '-' },
        { 'Statistique': 'Port', 'Valeur': this.projetActif.port || '-' },
        { 'Statistique': 'Produit', 'Valeur': this.projetActif.nomProduit || '-' }
      );
    }

    const wsStats: XLSX.WorkSheet = XLSX.utils.json_to_sheet(statsData);
    wsStats['!cols'] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsStats, 'Statistiques');

    // Télécharger le fichier
    const fileName = `Depots_${this.projetActif?.nomNavire || 'Liste'}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}
