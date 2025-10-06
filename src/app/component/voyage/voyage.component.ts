import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { VoyageDTO } from '../../api/model/voyageDTO';
import { ChauffeurControllerService } from '../../api/api/chauffeurController.service';
import { CamionControllerService } from '../../api/api/camionController.service';
import { ClientControllerService } from '../../api/api/clientController.service';
import { DepotControllerService } from '../../api/api/depotController.service';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { ProjetClientControllerService } from '../../api/api/projetClientController.service';
import { ChauffeurDTO } from '../../api/model/chauffeurDTO';
import { CamionDTO } from '../../api/model/camionDTO';
import { ClientDTO } from '../../api/model/clientDTO';
import { DepotDTO } from '../../api/model/depotDTO';
import { ProjetDTO } from '../../api/model/projetDTO';
import { ProjetClientDTO } from '../../api/model/projetClientDTO';
import { BreadcrumbItem } from '../breadcrumb/breadcrumb.component';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-voyage',
  templateUrl: './voyage.component.html',
  styleUrls: ['./voyage.component.css']
})
export class VoyageComponent {
  voyages: VoyageDTO[] = [];
  filteredVoyages: VoyageDTO[] = [];
  paginatedVoyages: VoyageDTO[] = [];
  projetActifId: number | null = null;
  projetActif: any = null;
  contextProjetId: number | null = null;
  contextProjet: any = null;
  breadcrumbItems: BreadcrumbItem[] = [];
  selectedVoyage: VoyageDTO | null = null;
  dialogVoyage: VoyageDTO & { _type?: 'client' | 'depot' } = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0, _type: undefined };
  editMode: boolean = false;
  error: string = '';
  chauffeurs: ChauffeurDTO[] = [];
  camions: CamionDTO[] = [];
  clients: ClientDTO[] = [];
  depots: DepotDTO[] = [];
  projets: ProjetDTO[] = [];
  projetsClients: ProjetClientDTO[] = [];
  isSidebarOpen: boolean = true;
  showAddDialog: boolean = false;
  voyageFilter: string = '';
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageSizes: number[] = [5, 10, 20, 50];
  
  // Tri
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  Math = Math;

  constructor(
    private voyageService: VoyageControllerService,
    private chauffeurService: ChauffeurControllerService,
    private camionService: CamionControllerService,
    private clientService: ClientControllerService,
    private depotService: DepotControllerService,
    private projetService: ProjetControllerService,
    private projetClientService: ProjetClientControllerService,
    private http: HttpClient,
    private route: ActivatedRoute
  ) {
    this.route.paramMap.subscribe(pm => {
      const pid = pm.get('id');
      this.projetActifId = pid ? Number(pid) : null;
      // context from session storage may override
      const contextId = window.sessionStorage.getItem('projetActifId');
      if (contextId) {
        this.contextProjetId = Number(contextId);
        this.loadProjetDetails(this.contextProjetId, true);
      } else if (this.projetActifId) {
        this.loadProjetDetails(this.projetActifId);
      }
      // Recharger les voyages selon contexte route
      this.loadVoyages();
    });
    this.loadProjets(); // charge aussi si pas de param route
    this.loadChauffeurs();
    this.loadCamions();
    this.loadClients();
    this.loadDepots();
    this.loadProjetsClients();
  }

  loadChauffeurs() {
    this.chauffeurService.getAllChauffeurs('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.chauffeurs = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing chauffeurs: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.chauffeurs = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement chauffeurs: ' + (err.error?.message || err.message)
    });
  }

  loadCamions() {
    this.camionService.getAllCamions('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.camions = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing camions: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.camions = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement camions: ' + (err.error?.message || err.message)
    });
  }

  loadClients() {
    this.clientService.getAllClients('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.clients = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing clients: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.clients = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement clients: ' + (err.error?.message || err.message)
    });
  }

  loadDepots() {
    this.depotService.getAllDepots('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.depots = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing depots: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.depots = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement depots: ' + (err.error?.message || err.message)
    });
  }

  loadProjetsClients() {
    // Charger les associations projet-client depuis le backend
    this.http.get<ProjetClientDTO[]>('http://localhost:8086/api/projet-client').subscribe({
      next: (data) => {
        this.projetsClients = data;
        console.log('✅ Projets clients chargés avec succès:', this.projetsClients);
        console.log(`📊 Nombre d'associations: ${this.projetsClients.length}`);
      },
      error: (err) => {
        console.error('❌ Erreur chargement projets clients:', err);
        console.error('📋 Détails erreur:', {
          status: err.status,
          message: err.message,
          url: err.url
        });
        // Valeur par défaut vide
        this.projetsClients = [];
      }
    });
  }

  // Calculer le reste total du projet (quantité totale - somme des livraisons)
  getResteProjet(): number {
    const projet = this.contextProjet || this.projetActif;
    if (!projet) return 0;
    
    const quantiteTotale = projet.quantiteTotale || 0;
    const totalLivre = this.voyages
      .filter(v => v.projetId === projet.id)
      .reduce((sum, v) => {
        return sum + (v.poidsClient || 0) + (v.poidsDepot || 0);
      }, 0);
    
    return quantiteTotale - totalLivre;
  }

  // Obtenir le nom et numéro d'un client
  getClientNomNumero(clientId: number | undefined): string {
    if (!clientId) return '-';
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return '-';
    return `${client.nom} (${client.numero || 'N/A'})`;
  }

  // Obtenir la quantité autorisée pour un client
  getQuantiteAutorisee(clientId: number | undefined): number {
    if (!clientId) {
      console.log('⚠️ getQuantiteAutorisee: clientId non défini');
      return 0;
    }
    const projetId = this.contextProjetId || this.projetActifId;
    if (!projetId) {
      console.log('⚠️ getQuantiteAutorisee: projetId non défini');
      return 0;
    }
    
    const projetClient = this.projetsClients.find(
      pc => pc.projetId === projetId && pc.clientId === clientId
    );
    
    if (!projetClient) {
      console.log(`❌ ProjetClient non trouvé pour projetId=${projetId}, clientId=${clientId}`);
      console.log(`📋 projetsClients disponibles (${this.projetsClients.length}):`, this.projetsClients);
    } else {
      console.log(`✅ ProjetClient trouvé: quantité autorisée = ${projetClient.quantiteAutorisee}`);
    }
    
    return projetClient?.quantiteAutorisee || 0;
  }

  // Calculer le total déjà livré pour un client
  getTotalLivreClient(clientId: number): number {
    const projetId = this.contextProjetId || this.projetActifId;
    if (!projetId) return 0;
    
    return this.voyages
      .filter(v => v.projetId === projetId && v.clientId === clientId)
      .reduce((sum, v) => sum + (v.poidsClient || 0), 0);
  }

  // Calculer le reste pour un client
  getResteClient(clientId: number): number {
    const quantiteAutorisee = this.getQuantiteAutorisee(clientId);
    const totalLivre = this.getTotalLivreClient(clientId);
    return quantiteAutorisee - totalLivre;
  }

  // Obtenir la couleur selon le pourcentage restant
  getResteColor(reste: number, quantiteAutorisee: number): string {
    if (quantiteAutorisee === 0) return '#64748b'; // gris
    const pourcentage = (reste / quantiteAutorisee) * 100;
    
    if (pourcentage > 50) return '#10b981'; // vert
    if (pourcentage > 20) return '#f59e0b'; // jaune
    return '#ef4444'; // rouge
  }

  // Mettre à jour le reste en temps réel quand on change de client ou de poids
  updateResteEnTempsReel() {
    if (this.dialogVoyage._type === 'client' && this.dialogVoyage.clientId) {
      const quantiteAutorisee = this.getQuantiteAutorisee(this.dialogVoyage.clientId);
      const totalLivre = this.getTotalLivreClient(this.dialogVoyage.clientId);
      const poidsActuel = Number(this.dialogVoyage.poidsClient) || 0;
      this.dialogVoyage.reste = quantiteAutorisee - totalLivre - poidsActuel;
    } else {
      this.dialogVoyage.reste = 0;
    }
  }

  // Mettre à jour le reste pour le dépôt (reste = quantité totale du projet - total livré)
  updateResteForDepot() {
    if (this.dialogVoyage._type === 'depot') {
      const resteProjet = this.getResteProjet();
      const poidsActuel = Number(this.dialogVoyage.poidsDepot) || 0;
      this.dialogVoyage.reste = resteProjet - poidsActuel;
    }
  }

  // Valider le poids saisi
  validatePoids(): boolean {
    if (this.dialogVoyage._type === 'client' && this.dialogVoyage.clientId) {
      const reste = this.getResteClient(this.dialogVoyage.clientId);
      const poidsActuel = Number(this.dialogVoyage.poidsClient) || 0;
      
      if (poidsActuel > reste) {
        this.error = `Le poids saisi (${poidsActuel}) dépasse le reste autorisé pour ce client (${reste})`;
        return false;
      }
    }
    return true;
  }

  loadProjets() {
    this.projetService.getAllProjets('body').subscribe({
      next: (data) => {
        let projets: ProjetDTO[] = [];
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              projets = JSON.parse(reader.result as string);
              this.projets = projets;
              if (this.projetActifId === null) {
                // si la route n'impose pas un projet, on prend actif pour vue globale
                const actif = projets.find(pr => pr.active);
                this.projetActifId = actif?.id || null;
              }
              // Charger les détails du projet actif ou contexte
              const contextId = window.sessionStorage.getItem('projetActifId');
              if (contextId) {
                this.contextProjetId = Number(contextId);
                this.loadProjetDetails(this.contextProjetId, true);
              } else if (this.projetActifId) {
                this.loadProjetDetails(this.projetActifId);
              }
              this.loadVoyages();
            } catch (e) {
              this.error = 'Erreur parsing projets: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          projets = data;
          this.projets = projets;
          if (this.projetActifId === null) {
            const actif = projets.find(pr => pr.active);
            this.projetActifId = actif?.id || null;
          }
          // Charger les détails du projet actif
          if (this.projetActifId) {
            this.loadProjetDetails(this.projetActifId);
          }
          this.loadVoyages();
        }
      },
      error: (err) => this.error = 'Erreur chargement projets: ' + (err.error?.message || err.message)
    });
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
    if (this.contextProjet) return this.contextProjet.active === true;
    return !!(this.projetActif && this.projetActif.active === true);
  }

  updateBreadcrumb() {
    const projet = this.contextProjet || this.projetActif;
    if (projet) {
      this.breadcrumbItems = [
        { label: 'Projets', url: '/projet' },
        { label: projet.nom || `Projet ${projet.id}`, url: `/projet/${projet.id}/parametre` },
        { label: 'Param\u00e8tres', url: `/projet/${projet.id}/parametre` },
        { label: 'Voyages' }
      ];
    } else {
      this.breadcrumbItems = [
        { label: 'Voyages' }
      ];
    }
  }



  openAddDialog() {
    const today = new Date().toISOString().split('T')[0];
    this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: today, poidsClient: 0, poidsDepot: 0, _type: undefined };
    this.showAddDialog = true;
    this.editMode = false;
    // Recharger les projets clients au cas où ils n'auraient pas été chargés
    if (this.projetsClients.length === 0) {
      this.loadProjetsClients();
    }
  }

  selectVoyage(vg: VoyageDTO) {
    this.dialogVoyage = { ...vg };
    this.selectedVoyage = vg;
    this.editMode = true;
    this.showAddDialog = false;
  }

  addDialogVoyage() {
    const targetProjetId = this.contextProjetId || this.projetActifId;
    if (targetProjetId) {
      this.dialogVoyage.projetId = targetProjetId;
    }
    
    // Validation des champs obligatoires
    if (!this.dialogVoyage.projetId) {
      this.error = 'Sélectionne un projet pour créer un voyage.';
      return;
    }
    if (!this.dialogVoyage.numBonLivraison) {
      this.error = 'Le numéro de bon de livraison est obligatoire.';
      return;
    }
    if (!this.dialogVoyage.numTicket) {
      this.error = 'Le numéro de ticket est obligatoire.';
      return;
    }
    if (!this.dialogVoyage.date) {
      this.error = 'La date est obligatoire.';
      return;
    }
    if (!this.dialogVoyage.chauffeurId) {
      this.error = 'Le chauffeur est obligatoire.';
      return;
    }
    if (!this.dialogVoyage.camionId) {
      this.error = 'Le camion est obligatoire.';
      return;
    }
    if (!this.dialogVoyage._type) {
      this.error = 'Veuillez sélectionner Client ou Dépôt.';
      return;
    }
    if (this.dialogVoyage._type === 'client' && !this.dialogVoyage.clientId) {
      this.error = 'Veuillez sélectionner un client.';
      return;
    }
    if (this.dialogVoyage._type === 'depot' && !this.dialogVoyage.depotId) {
      this.error = 'Veuillez sélectionner un dépôt.';
      return;
    }
    
    // Validation du poids pour les clients
    if (!this.validatePoids()) {
      return;
    }
    
    this.dialogVoyage.userId = 1;

    // Normalisation du payload pour correspondre exactement au VoyageDTO backend
    const payload: any = {
      numBonLivraison: this.dialogVoyage.numBonLivraison?.trim(),
      numTicket: this.dialogVoyage.numTicket?.trim(),
      reste: this.dialogVoyage.reste != null ? Number(this.dialogVoyage.reste) : 0,
      date: this.dialogVoyage.date ? this.dialogVoyage.date : undefined,
      poidsClient: undefined as number | undefined,
      poidsDepot: undefined as number | undefined,
      chauffeurId: this.dialogVoyage.chauffeurId,
      camionId: this.dialogVoyage.camionId,
      clientId: undefined as number | undefined,
      depotId: undefined as number | undefined,
      projetId: this.dialogVoyage.projetId,
      userId: this.dialogVoyage.userId
    };

    // Mutuelle exclusivité client/depot
    if (this.dialogVoyage._type === 'client') {
      payload.clientId = this.dialogVoyage.clientId!;
      if (this.dialogVoyage.poidsClient != null) {
        payload.poidsClient = Number(this.dialogVoyage.poidsClient);
      }
    } else if (this.dialogVoyage._type === 'depot') {
      payload.depotId = this.dialogVoyage.depotId!;
      if (this.dialogVoyage.poidsDepot != null) {
        payload.poidsDepot = Number(this.dialogVoyage.poidsDepot);
      }
    }

    // Nettoyage: retirer les clés undefined pour éviter d'envoyer des champs superflus
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    console.log('Payload voyage envoyé ->', payload);

    this.voyageService.createVoyage(payload, 'body').subscribe({
      next: (createdVoyage) => {
        console.log('Voyage créé:', createdVoyage);
        this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0, _type: undefined };
        this.error = '';
        this.closeDialog();
        // Recharger la liste pour afficher le nouveau voyage
        this.loadVoyages();
      },
      error: (err) => {
        console.error('Erreur création voyage:', err);
        const backendMsg = (typeof err.error === 'string') ? err.error : (err.error?.message || err.message);
        this.error = 'Erreur ajout: ' + (backendMsg || 'Erreur inconnue');
      }
    });
  }

  updateDialogVoyage() {
    if (!this.dialogVoyage?.id) return;
    const requiredFields = ['camionId', 'chauffeurId', 'clientId', 'depotId', 'projetId', 'userId'];
    for (const field of requiredFields) {
      if (this.dialogVoyage[field as keyof VoyageDTO] == null) {
        this.error = `Le champ ${field} est obligatoire.`;
        return;
      }
    }
    console.log(this.dialogVoyage);
    if (!this.dialogVoyage?.id) {
      this.error = "L'id du voyage à modifier est manquant.";
      return;
    }
    this.voyageService.updateVoyage(this.dialogVoyage.id, this.dialogVoyage, 'body').subscribe({
      next: () => {
        this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0 };
        this.selectedVoyage = null;
        this.editMode = false;
        this.loadVoyages();
        this.closeDialog();
      },
      error: (err) => {
        console.error('Erreur backend:', err);
        if (err.error instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            this.error = 'Erreur modification: ' + reader.result;
          };
          reader.readAsText(err.error);
        } else if (err.error) {
          this.error = 'Erreur modification: ' + err.error;
        } else {
          this.error = 'Erreur modification: ' + (err.message || '');
        }
      }
    });
  }

  closeDialog() {
    this.showAddDialog = false;
    this.editMode = false;
    this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0 };
    this.selectedVoyage = null;
    this.error = '';
  }

  applyFilter() {
    const filter = this.voyageFilter.trim().toLowerCase();
    let voyagesFiltrés = this.voyages;
    if (this.projetActifId) {
      voyagesFiltrés = voyagesFiltrés.filter(vg => vg.projetId === this.projetActifId);
    }
    if (filter) {
      voyagesFiltrés = voyagesFiltrés.filter(vg =>
        (vg.numBonLivraison?.toLowerCase().includes(filter) || false) ||
        (vg.numTicket?.toLowerCase().includes(filter) || false)
      );
    }
    this.filteredVoyages = voyagesFiltrés;
    this.updatePagination();
  }
  
  sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortVoyages();
  }
  
  sortVoyages() {
    if (!this.sortColumn) {
      this.updatePagination();
      return;
    }
    
    this.filteredVoyages.sort((a, b) => {
      let aVal: any = a[this.sortColumn as keyof VoyageDTO];
      let bVal: any = b[this.sortColumn as keyof VoyageDTO];
      
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
    this.totalPages = Math.ceil(this.filteredVoyages.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedVoyages = this.filteredVoyages.slice(startIndex, endIndex);
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

  loadVoyages() {
    // Si on a un projet explicite dans l'URL => appel dédié
    if (this.projetActifId !== null && this.route.snapshot.routeConfig?.path?.includes('projet/:id/voyages')) {
      this.voyageService.getVoyagesByProjet(this.projetActifId, 'body').subscribe({
        next: (data) => {
          if (data instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                this.voyages = JSON.parse(reader.result as string);
              } catch (e) {
                this.error = 'Erreur parsing: ' + e;
              }
              this.applyFilter();
            };
            reader.readAsText(data);
          } else {
            this.voyages = data;
            this.applyFilter();
          }
        },
        error: (err) => this.error = 'Erreur chargement voyages projet: ' + (err.error?.message || err.message)
      });
      return;
    }

    // Sinon vue globale (tous puis filtrage éventuel par projet actif sélectionné)
    this.voyageService.getAllVoyages('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
            reader.onload = () => {
              try {
                this.voyages = JSON.parse(reader.result as string);
              } catch (e) {
                this.error = 'Erreur parsing: ' + e;
              }
              this.applyFilter();
            };
            reader.readAsText(data);
        } else {
          this.voyages = data;
          this.applyFilter();
        }
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }

  deleteVoyage(id?: number) {
    if (id === undefined) return;
    this.voyageService.deleteVoyage(id, 'body').subscribe({
      next: () => {
        this.loadVoyages();
      },
      error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
    });
  }
}
