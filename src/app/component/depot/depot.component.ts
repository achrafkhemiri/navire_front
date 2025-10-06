import { Component } from '@angular/core';
import { DepotControllerService } from '../../api/api/depotController.service';
import { HttpClient } from '@angular/common/http';
import { Inject } from '@angular/core';
import { BASE_PATH } from '../../api/variables';
import { ProjetActifService } from '../../service/projet-actif.service';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { DepotDTO } from '../../api/model/depotDTO';
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
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageSizes: number[] = [5, 10, 20, 50];
  
  // Tri
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  Math = Math;

  constructor(private depotService: DepotControllerService, private projetActifService: ProjetActifService, private projetService: ProjetControllerService, private http: HttpClient, @Inject(BASE_PATH) private basePath: string) {
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
    this.loadDepots();
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

  canAddData(): boolean {
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
    this.showAddDialog = true;
    this.editMode = false;
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
    // Associe le projet actif
    const targetProjetId = this.contextProjetId || this.projetActifId;
    if (targetProjetId) {
      this.dialogDepot.projetId = targetProjetId;
    }

    // Log request payload
  console.log('Création depot - payload:', this.dialogDepot);

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
    // Filtre par projet actif
    const targetProjetId = this.contextProjetId || this.projetActifId;
    if (targetProjetId) {
      // If depots were returned from the project-scoped endpoint they may not include projetId
      depotsFiltrés = depotsFiltrés.filter(d => (d.projetId === undefined) || (d.projetId === targetProjetId));
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
    console.log('loadDepots() - targetProjetId:', targetProjetId);
    if (targetProjetId) {
      // Prefer server endpoint that returns depots for a project
      const url = `${this.basePath}/api/projets/${targetProjetId}/depots`;
      this.http.get<any[]>(url, { withCredentials: true, responseType: 'json' as 'json' }).subscribe({
        next: (data) => {
          console.log('loadDepots() - project-scoped response:', data);
          if (Array.isArray(data)) {
            this.depots = data;
          } else {
            this.depots = [];
          }
          this.applyFilter();
        },
        error: err => {
          console.warn('Project-scoped depot request failed, falling back to getAllDepots', err);
          // fallback to existing getAllDepots behavior
          this.depotService.getAllDepots('body').subscribe({
            next: async (data) => {
              console.log('loadDepots() - raw response:', data);
              if (data instanceof Blob) {
                const text = await data.text();
                console.log('loadDepots() - blob text:', text);
                try {
                  const json = JSON.parse(text);
                  console.log('loadDepots() - parsed json:', json);
                  if (Array.isArray(json)) {
                    this.depots = json;
                  } else {
                    this.depots = [];
                  }
                } catch (e) {
                  this.error = 'Erreur parsing JSON: ' + e;
                  console.error('Erreur parsing JSON in loadDepots:', e);
                  this.depots = [];
                }
              } else if (Array.isArray(data)) {
                console.log('loadDepots() - json array, length:', data.length);
                this.depots = data;
              } else {
                console.log('loadDepots() - unexpected response:', data);
                this.depots = [];
              }
              this.applyFilter();
            },
            error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
          });
        }
      });
    } else {
      // If no active project, fetch all depots
      this.depotService.getAllDepots('body').subscribe({
        next: async (data) => {
          console.log('loadDepots() - raw response:', data);
          if (data instanceof Blob) {
            const text = await data.text();
            console.log('loadDepots() - blob text:', text);
            try {
              const json = JSON.parse(text);
              console.log('loadDepots() - parsed json:', json);
              if (Array.isArray(json)) {
                this.depots = json;
              } else {
                this.depots = [];
              }
            } catch (e) {
              this.error = 'Erreur parsing JSON: ' + e;
              console.error('Erreur parsing JSON in loadDepots:', e);
              this.depots = [];
            }
          } else if (Array.isArray(data)) {
            console.log('loadDepots() - json array, length:', data.length);
            this.depots = data;
          } else {
            console.log('loadDepots() - unexpected response:', data);
            this.depots = [];
          }
          this.applyFilter();
        },
        error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
      });
    }
  }
}
