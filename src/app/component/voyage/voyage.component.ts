import { Component, HostListener, Inject } from '@angular/core';
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
import { BASE_PATH } from '../../api/variables';
import { ProjetActifService } from '../../service/projet-actif.service';
import * as XLSX from 'xlsx';

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
  
  // Camion search/create
  camionSearchInput: string = '';
  filteredCamions: CamionDTO[] = [];
  showCamionDropdown: boolean = false;
  isCreatingCamion: boolean = false;
  
  // Chauffeur search/create
  chauffeurSearchInput: string = '';
  filteredChauffeurs: ChauffeurDTO[] = [];
  showChauffeurDropdown: boolean = false;
  isCreatingChauffeur: boolean = false;
  chauffeurCinInput: string = '';
  
  // Société search
  societeSearchInput: string = '';
  filteredSocietes: string[] = [];
  showSocieteDropdown: boolean = false;
  allSocietes: string[] = [];
  societeDropdownTimer: any = null;
  
  // Client search
  clientSearchInput: string = '';
  filteredClientsSearch: ClientDTO[] = [];
  showClientDropdown: boolean = false;
  
  // Depot search
  depotSearchInput: string = '';
  filteredDepotsSearch: DepotDTO[] = [];
  showDepotDropdown: boolean = false;
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageSizes: number[] = [5, 10, 20, 50];
  
  // Tri
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Filtres
  activeFilter: 'all' | 'date' | 'client' | 'depot' = 'all';
  selectedDate: string | null = null;
  selectedClientId: number | null = null;
  selectedDepotId: number | null = null;
  
  Math = Math;

  constructor(
    private voyageService: VoyageControllerService,
    private chauffeurService: ChauffeurControllerService,
    private camionService: CamionControllerService,
    private clientService: ClientControllerService,
    private depotService: DepotControllerService,
    private projetService: ProjetControllerService,
    private projetClientService: ProjetClientControllerService,
    private projetActifService: ProjetActifService,
    private http: HttpClient,
    private route: ActivatedRoute,
    @Inject(BASE_PATH) private basePath: string
  ) {
    // 🔥 Écouter les changements du projet actif
    this.projetActifService.projetActif$.subscribe(projet => {
      console.log('📡 [Voyage] Notification reçue - Nouveau projet:', projet);
      
      if (projet && projet.id) {
        const previousId = this.projetActifId;
        this.projetActifId = projet.id;
        this.projetActif = projet;
        
        // 🔥 FIX : Recharger si le projet change OU si c'est la première fois
        if (!previousId || previousId !== projet.id) {
          console.log('🔄 [Voyage] Rechargement - previousId:', previousId, 'newId:', projet.id);
          setTimeout(() => {
            this.reloadData();
          }, 50);
        }
      }
    });
    
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

  // 🔥 Méthode pour recharger toutes les données
  reloadData() {
    console.log('🔄 [Voyage] reloadData() - Projet actif:', this.projetActif?.nom, 'ID:', this.projetActifId);
    
    const currentUrl = window.location.pathname;
    const isOnParametrePage = currentUrl.includes('/parametre');
    
    if (isOnParametrePage) {
      const contextId = window.sessionStorage.getItem('projetActifId');
      if (contextId) {
        const contextIdNumber = Number(contextId);
        console.log('📌 [Voyage] Page paramètre - Contexte:', contextIdNumber);
        this.contextProjetId = contextIdNumber;
        if (contextIdNumber !== this.projetActifId) {
          this.loadProjetDetails(this.contextProjetId, true);
        } else {
          this.contextProjet = this.projetActif;
        }
      }
    } else {
      console.log('🏠 [Voyage] Mode Vue Projet Actif - Projet:', this.projetActif?.nom);
      this.contextProjetId = null;
      this.contextProjet = null;
    }
    
    // Recharger toutes les données
    this.loadVoyages();
    this.loadChauffeurs();
    this.loadCamions();
    this.loadClients();
    this.loadDepots();
    this.loadProjetsClients();
  }

  // Fermer les dropdowns lors d'un clic en dehors
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Vérifier si le clic est en dehors du dropdown chauffeur
    const chauffeurInput = target.closest('.chauffeur-search-container');
    if (!chauffeurInput && this.showChauffeurDropdown) {
      this.showChauffeurDropdown = false;
    }
    
    // Vérifier si le clic est en dehors du dropdown camion
    const camionInput = target.closest('.camion-search-container');
    if (!camionInput && this.showCamionDropdown) {
      this.showCamionDropdown = false;
    }
    
    // Vérifier si le clic est en dehors du dropdown société
    const societeInput = target.closest('.societe-search-container');
    if (!societeInput && this.showSocieteDropdown) {
      this.showSocieteDropdown = false;
    }
    
    // Vérifier si le clic est en dehors du dropdown client
    const clientInput = target.closest('.client-search-container');
    if (!clientInput && this.showClientDropdown) {
      this.showClientDropdown = false;
    }
    
    // Vérifier si le clic est en dehors du dropdown dépôt
    const depotInput = target.closest('.depot-search-container');
    if (!depotInput && this.showDepotDropdown) {
      this.showDepotDropdown = false;
    }
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
    const projetId = this.contextProjetId || this.projetActifId;
    
    // 🔥 TOUJOURS charger seulement les clients du projet actif
    if (projetId) {
      console.log('📥 Chargement des clients pour le projet:', projetId);
      this.clientService.getClientsByProjet(projetId, 'body').subscribe({
        next: async (data) => {
          if (data instanceof Blob) {
            const text = await data.text();
            try {
              const parsed = JSON.parse(text);
              this.clients = Array.isArray(parsed) ? parsed : [];
              console.log('✅ Clients du projet chargés:', this.clients.length, this.clients);
            } catch (e) {
              console.error('❌ Erreur parsing clients:', e);
              this.clients = [];
            }
          } else {
            this.clients = Array.isArray(data) ? data : [];
            console.log('✅ Clients du projet chargés:', this.clients.length, this.clients);
          }
        },
        error: (err) => {
          console.error('❌ Erreur chargement clients du projet:', err);
          this.error = 'Erreur chargement clients: ' + (err.error?.message || err.message);
          this.clients = [];
        }
      });
    } else {
      // 🔥 Si pas de projet actif, vider la liste au lieu de charger tous les clients
      console.warn('⚠️ Pas de projet actif, impossible de charger les clients');
      this.clients = [];
    }
  }

  loadDepots() {
    const projetId = this.contextProjetId || this.projetActifId;
    
    if (!projetId) {
      console.log('⚠️ Pas de projet actif, impossible de charger les dépôts');
      this.depots = [];
      return;
    }
    
    console.log(`📦 Chargement des dépôts du projet ${projetId}...`);
    
    // Utiliser l'endpoint spécifique au projet avec le basePath correct
    const url = `${this.basePath}/api/projets/${projetId}/depots`;
    console.log(`🔗 URL: ${url}`);
    
    this.http.get<DepotDTO[]>(url).subscribe({
      next: (data) => {
        this.depots = data;
        console.log(`✅ ${this.depots.length} dépôt(s) chargé(s) pour le projet ${projetId}`);
      },
      error: (err) => {
        console.error('❌ Erreur chargement dépôts:', err);
        this.error = 'Erreur chargement depots: ' + (err.error?.message || err.message);
        this.depots = [];
      }
    });
  }

  loadProjetsClients() {
    const projetId = this.contextProjetId || this.projetActifId;
    
    if (!projetId) {
      console.log('⚠️ Pas de projet actif, impossible de charger les projets-clients');
      this.projetsClients = [];
      return;
    }
    
    // Charger les clients du projet avec leurs quantités autorisées
    console.log(`📥 Chargement des clients du projet ${projetId} avec quantités...`);
    this.clientService.getClientsByProjet(projetId, 'body').subscribe({
      next: async (data) => {
        let clients: any[] = [];
        
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const parsed = JSON.parse(text);
            clients = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            console.error('❌ Erreur parsing clients:', e);
            clients = [];
          }
        } else {
          clients = Array.isArray(data) ? data : [];
        }
        
        // Convertir les clients en ProjetClientDTO pour compatibilité
        this.projetsClients = clients.map(client => ({
          id: client.id,
          projetId: projetId,
          clientId: client.id,
          quantiteAutorisee: client.quantitesAutoriseesParProjet?.[projetId] || 0
        }));
        
        console.log('✅ Projets clients créés avec succès:', this.projetsClients);
        console.log(`📊 Nombre d'associations: ${this.projetsClients.length}`);
        
        // Afficher les détails de chaque association pour debug
        this.projetsClients.forEach((pc, index) => {
          console.log(`  ${index + 1}. ProjetId: ${pc.projetId}, ClientId: ${pc.clientId}, Quantité: ${pc.quantiteAutorisee}`);
        });
      },
      error: (err) => {
        console.error('❌ Erreur chargement clients du projet:', err);
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

  // Calculer le reste du projet au moment actuel (pour affichage dynamique)
  // Cette méthode affiche toujours le reste ACTUEL du projet, pas celui stocké lors de la création du voyage
  getResteProjetActuel(): number {
    return this.getResteProjet();
  }

  // Calculer le reste pour un voyage spécifique (après ce voyage)
  // Le reste = Quantité totale - Somme de tous les voyages du même projet créés AVANT OU AU MOMENT de ce voyage
  getResteForVoyage(voyage: VoyageDTO): number {
    const projet = this.contextProjet || this.projetActif;
    if (!projet) return 0;
    
    const quantiteTotale = projet.quantiteTotale || 0;
    
    // Récupérer la date du voyage actuel
    const voyageDate = voyage.date ? new Date(voyage.date).getTime() : Date.now();
    
    // Calculer le total des livraisons JUSQU'À ce voyage (inclus)
    const totalLivreJusquAVoyage = this.voyages
      .filter(v => {
        if (v.projetId !== projet.id) return false;
        
        // Comparer les dates : inclure tous les voyages créés avant ou au même moment
        const vDate = v.date ? new Date(v.date).getTime() : 0;
        return vDate <= voyageDate;
      })
      .reduce((sum, v) => {
        return sum + (v.poidsClient || 0) + (v.poidsDepot || 0);
      }, 0);
    
    return quantiteTotale - totalLivreJusquAVoyage;
  }

  // Obtenir la couleur du reste pour un voyage (vert/orange/rouge selon le pourcentage restant)
  getResteColorForVoyage(voyage: VoyageDTO): string {
    const projet = this.contextProjet || this.projetActif;
    if (!projet) return '#64748b'; // Gris par défaut
    
    const reste = this.getResteForVoyage(voyage);
    const quantiteTotale = projet.quantiteTotale || 0;
    
    if (quantiteTotale === 0) return '#64748b';
    
    const pourcentage = (reste / quantiteTotale) * 100;
    
    if (pourcentage > 50) return '#10b981'; // Vert
    if (pourcentage > 20) return '#f59e0b'; // Orange
    if (pourcentage >= 0) return '#ef4444'; // Rouge
    return '#dc2626'; // Rouge foncé (négatif - dépassement)
  }

  // Obtenir le nom et numéro d'un client
  getClientNomNumero(clientId: number | undefined): string {
    if (!clientId) return '-';
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return '-';
    return `${client.nom} (${client.numero || 'N/A'})`;
  }

  // Obtenir le nom d'un dépôt
  getDepotNom(depotId: number | undefined): string {
    if (!depotId) return '-';
    const depot = this.depots.find(d => d.id === depotId);
    if (!depot) return '-';
    return depot.nom || 'N/A';
  }

  // Obtenir le matricule et la société d'un camion
  getCamionInfo(camionId: number | undefined, societeName?: string): string {
    if (!camionId) return '-';
    const camion = this.camions.find(c => c.id === camionId);
    if (!camion) return '-';
    const matricule = camion.matricule || 'N/A';
    const societe = societeName || 'N/A';
    return `${matricule} (${societe})`;
  }

  // Obtenir le nom et le CIN d'un chauffeur
  getChauffeurInfo(chauffeurId: number | undefined): string {
    if (!chauffeurId) return '-';
    const chauffeur = this.chauffeurs.find(ch => ch.id === chauffeurId);
    if (!chauffeur) return '-';
    const nom = chauffeur.nom || 'N/A';
    const cin = chauffeur.numCin || 'N/A';
    return `${nom} (${cin})`;
  }

  // Filtrer les camions selon l'input de recherche
  onCamionSearchInput(): void {
    const searchValue = this.camionSearchInput.trim().toLowerCase();
    
    if (!searchValue) {
      this.filteredCamions = [];
      this.showCamionDropdown = false;
      return;
    }
    
    // Filtrer les camions existants par matricule
    this.filteredCamions = this.camions.filter(c => 
      c.matricule?.toLowerCase().includes(searchValue)
    );
    
    this.showCamionDropdown = true;
  }

  // Sélectionner un camion existant
  selectCamion(camion: CamionDTO): void {
    this.dialogVoyage.camionId = camion.id;
    this.camionSearchInput = camion.matricule;
    this.showCamionDropdown = false;
    this.filteredCamions = [];
  }

  // Créer un nouveau camion et l'associer au voyage
  async createAndSelectCamion(): Promise<void> {
    const matricule = this.camionSearchInput.trim();
    
    if (!matricule) {
      this.error = 'Veuillez entrer un matricule de camion.';
      return;
    }

    // Vérifier si le camion existe déjà
    const existingCamion = this.camions.find(c => 
      c.matricule?.toLowerCase() === matricule.toLowerCase()
    );
    
    if (existingCamion) {
      this.selectCamion(existingCamion);
      return;
    }

    // Créer un nouveau camion
    this.isCreatingCamion = true;
    this.error = '';
    
    const newCamion: CamionDTO = {
      matricule: matricule,
      societe: this.dialogVoyage.societe || 'N/A'
    };

    try {
      const response = await this.camionService.createCamion(newCamion, 'body').toPromise();
      
      if (response) {
        let createdCamion: CamionDTO;
        
        if (response instanceof Blob) {
          const text = await response.text();
          createdCamion = JSON.parse(text);
        } else {
          createdCamion = response;
        }
        
        // Ajouter le nouveau camion à la liste
        this.camions.push(createdCamion);
        
        // Sélectionner le nouveau camion
        this.dialogVoyage.camionId = createdCamion.id;
        this.camionSearchInput = createdCamion.matricule;
        this.showCamionDropdown = false;
        this.filteredCamions = [];
        
        console.log('✅ Camion créé avec succès:', createdCamion);
      }
    } catch (err: any) {
      console.error('❌ Erreur lors de la création du camion:', err);
      this.error = 'Erreur lors de la création du camion: ' + (err.error?.message || err.message);
    } finally {
      this.isCreatingCamion = false;
    }
  }

  // Réinitialiser la recherche de camion
  resetCamionSearch(): void {
    this.camionSearchInput = '';
    this.filteredCamions = [];
    this.showCamionDropdown = false;
    this.dialogVoyage.camionId = undefined;
  }

  // Filtrer les chauffeurs selon l'input de recherche (par nom ou CIN)
  onChauffeurSearchInput(): void {
    const searchValue = this.chauffeurSearchInput.trim().toLowerCase();
    
    if (!searchValue) {
      this.filteredChauffeurs = [];
      this.showChauffeurDropdown = false;
      return;
    }
    
    // Filtrer les chauffeurs existants par nom ou CIN
    this.filteredChauffeurs = this.chauffeurs.filter(ch => 
      ch.nom?.toLowerCase().includes(searchValue) ||
      ch.numCin?.toLowerCase().includes(searchValue)
    );
    
    this.showChauffeurDropdown = true;
  }

  // Sélectionner un chauffeur existant
  selectChauffeur(chauffeur: ChauffeurDTO): void {
    this.dialogVoyage.chauffeurId = chauffeur.id;
    this.chauffeurSearchInput = chauffeur.nom;
    this.showChauffeurDropdown = false;
    this.filteredChauffeurs = [];
  }

  // Créer un nouveau chauffeur et l'associer au voyage
  async createAndSelectChauffeur(nom: string, cin: string): Promise<void> {
    if (!nom.trim() || !cin.trim()) {
      this.error = 'Veuillez entrer le nom et le CIN du chauffeur.';
      return;
    }

    // Vérifier si le chauffeur existe déjà (par CIN)
    const existingChauffeur = this.chauffeurs.find(ch => 
      ch.numCin?.toLowerCase() === cin.toLowerCase()
    );
    
    if (existingChauffeur) {
      this.selectChauffeur(existingChauffeur);
      return;
    }

    // Créer un nouveau chauffeur
    this.isCreatingChauffeur = true;
    this.error = '';
    
    const newChauffeur: ChauffeurDTO = {
      nom: nom.trim(),
      numCin: cin.trim()
    };

    try {
      const response = await this.chauffeurService.createChauffeur(newChauffeur, 'body').toPromise();
      
      if (response) {
        let createdChauffeur: ChauffeurDTO;
        
        if (response instanceof Blob) {
          const text = await response.text();
          createdChauffeur = JSON.parse(text);
        } else {
          createdChauffeur = response;
        }
        
        // Ajouter le nouveau chauffeur à la liste
        this.chauffeurs.push(createdChauffeur);
        
        // Sélectionner le nouveau chauffeur
        this.dialogVoyage.chauffeurId = createdChauffeur.id;
        this.chauffeurSearchInput = createdChauffeur.nom;
        this.showChauffeurDropdown = false;
        this.filteredChauffeurs = [];
        
        console.log('✅ Chauffeur créé avec succès:', createdChauffeur);
      }
    } catch (err: any) {
      console.error('❌ Erreur lors de la création du chauffeur:', err);
      this.error = 'Erreur lors de la création du chauffeur: ' + (err.error?.message || err.message);
    } finally {
      this.isCreatingChauffeur = false;
    }
  }

  // Réinitialiser la recherche de chauffeur
  resetChauffeurSearch(): void {
    this.chauffeurSearchInput = '';
    this.chauffeurCinInput = '';
    this.filteredChauffeurs = [];
    this.showChauffeurDropdown = false;
    this.dialogVoyage.chauffeurId = undefined;
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
    console.log('🔄 updateResteEnTempsReel appelée');
    console.log('  Type:', this.dialogVoyage._type);
    console.log('  ClientId:', this.dialogVoyage.clientId);
    
    if (this.dialogVoyage._type === 'client' && this.dialogVoyage.clientId) {
      const quantiteAutorisee = this.getQuantiteAutorisee(this.dialogVoyage.clientId);
      const totalLivre = this.getTotalLivreClient(this.dialogVoyage.clientId);
      const poidsActuel = Number(this.dialogVoyage.poidsClient) || 0;
      
      console.log('  📊 Quantité autorisée:', quantiteAutorisee);
      console.log('  📦 Total déjà livré:', totalLivre);
      console.log('  ⚖️ Poids actuel:', poidsActuel);
      
      // this.dialogVoyage.reste = quantiteAutorisee - totalLivre - poidsActuel;
      const resteProjet = this.getResteProjet();
      // const poidsActuel = Number(this.dialogVoyage.poidsDepot) || 0;
      this.dialogVoyage.reste = resteProjet - poidsActuel;
      console.log('  ✅ Reste calculé:', this.dialogVoyage.reste);
    } else {
      this.dialogVoyage.reste = 0;
      console.log('  ⚠️ Pas de client sélectionné ou type non-client');
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
            // Recharger les clients et projets-clients pour ce projet
            this.loadClients();
            this.loadProjetsClients();
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
          // Recharger les clients et projets-clients pour ce projet
          this.loadClients();
          this.loadProjetsClients();
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
    // 🕐 Définir automatiquement la date et heure actuelle
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    
    this.dialogVoyage = { 
      numBonLivraison: '', 
      numTicket: '', 
      reste: 0, 
      date: localDateTime,  // Date automatique (pas de champ visible)
      poidsClient: 0, 
      poidsDepot: 0, 
      societe: '', 
      _type: 'client' 
    };
    
    this.showAddDialog = true;
    this.editMode = false;
    
    // Réinitialiser les champs de recherche
    this.resetCamionSearch();
    this.resetChauffeurSearch();
    this.resetSocieteSearch();
    this.resetClientSearch();
    this.resetDepotSearch();
    
    // Toujours recharger les projets clients pour s'assurer d'avoir les données à jour
    console.log('🔄 Rechargement des projets clients...');
    this.loadProjetsClients();
    
    // Debug: afficher le projet actif et les clients disponibles
    const projetId = this.contextProjetId || this.projetActifId;
    console.log('📌 Projet actif:', projetId);
    console.log('📌 Context projet:', this.contextProjet);
    console.log('📌 Projet actif:', this.projetActif);
    console.log('👥 Clients du projet disponibles:', this.clients.length, this.clients);
  }

  selectVoyage(vg: VoyageDTO) {
    this.dialogVoyage = { ...vg };
    
    // Convertir la date au format datetime-local si elle existe
    if (vg.date) {
      const dateStr = vg.date.toString();
      if (dateStr.includes('T')) {
        // Si la date contient déjà un T, prendre les 16 premiers caractères (YYYY-MM-DDTHH:mm)
        this.dialogVoyage.date = dateStr.slice(0, 16);
      } else {
        // Si c'est juste une date, ajouter l'heure 00:00
        this.dialogVoyage.date = dateStr + 'T00:00';
      }
    }
    
    this.selectedVoyage = vg;
    this.editMode = true;
    this.showAddDialog = false;
    
    // Initialiser le champ de recherche de camion avec le matricule actuel
    if (vg.camionId) {
      const camion = this.camions.find(c => c.id === vg.camionId);
      if (camion) {
        this.camionSearchInput = camion.matricule;
      }
    }
    
    // Initialiser le champ de recherche de chauffeur avec le nom actuel
    if (vg.chauffeurId) {
      const chauffeur = this.chauffeurs.find(ch => ch.id === vg.chauffeurId);
      if (chauffeur) {
        this.chauffeurSearchInput = chauffeur.nom;
      }
    }
    
    // Initialiser le champ de recherche de société avec la société actuelle
    if (vg.societe) {
      this.societeSearchInput = vg.societe;
    }
  }

  async addDialogVoyage() {
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
    
    // Vérification et création du chauffeur si nécessaire
    if (!this.dialogVoyage.chauffeurId && this.chauffeurSearchInput.trim() && this.chauffeurCinInput.trim()) {
      await this.createAndSelectChauffeur(this.chauffeurSearchInput, this.chauffeurCinInput);
    }
    
    if (!this.dialogVoyage.chauffeurId) {
      this.error = 'Le chauffeur est obligatoire.';
      return;
    }
    
    // Vérification et création du camion si nécessaire
    if (!this.dialogVoyage.camionId && this.camionSearchInput.trim()) {
      await this.createAndSelectCamion();
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
      societe: this.dialogVoyage.societe?.trim() || undefined,
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
        this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0, societe: '', _type: undefined };
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

  async updateDialogVoyage() {
    if (!this.dialogVoyage?.id) return;
    
    // Vérification et création du chauffeur si nécessaire
    if (!this.dialogVoyage.chauffeurId && this.chauffeurSearchInput.trim() && this.chauffeurCinInput.trim()) {
      await this.createAndSelectChauffeur(this.chauffeurSearchInput, this.chauffeurCinInput);
    }
    
    // Vérification et création du camion si nécessaire
    if (!this.dialogVoyage.camionId && this.camionSearchInput.trim()) {
      await this.createAndSelectCamion();
    }
    
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
        this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0, societe: '' };
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
    this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0, societe: '' };
    this.selectedVoyage = null;
    this.error = '';
    
    // Réinitialiser les champs de recherche
    this.resetCamionSearch();
    this.resetChauffeurSearch();
    this.resetSocieteSearch();
  }

  applyFilter() {
    const filter = this.voyageFilter.trim().toLowerCase();
    let voyagesFiltrés = this.voyages;
    
    // Filtre par projet actif
    if (this.projetActifId) {
      voyagesFiltrés = voyagesFiltrés.filter(vg => vg.projetId === this.projetActifId);
    }
    
    // Filtre par recherche textuelle
    if (filter) {
      voyagesFiltrés = voyagesFiltrés.filter(vg =>
        (vg.numBonLivraison?.toLowerCase().includes(filter) || false) ||
        (vg.numTicket?.toLowerCase().includes(filter) || false) ||
        (vg.societe?.toLowerCase().includes(filter) || false)
      );
    }
    
    // Filtres par boutons
    if (this.activeFilter === 'date' && this.selectedDate) {
      voyagesFiltrés = voyagesFiltrés.filter(vg => {
        if (!vg.date) return false;
        
        // Journée de travail : de 7h du jour sélectionné à 7h du lendemain
        const selectedDateObj = new Date(this.selectedDate + 'T00:00:00');
        const startWorkDay = new Date(selectedDateObj);
        startWorkDay.setHours(7, 0, 0, 0); // 7h00 du jour sélectionné
        
        const endWorkDay = new Date(selectedDateObj);
        endWorkDay.setDate(endWorkDay.getDate() + 1);
        endWorkDay.setHours(7, 0, 0, 0); // 7h00 du lendemain
        
        const voyageDateTime = new Date(vg.date);
        
        // Le voyage est inclus s'il est entre 7h du jour sélectionné et 7h du lendemain
        return voyageDateTime >= startWorkDay && voyageDateTime < endWorkDay;
      });
    } else if (this.activeFilter === 'client' && this.selectedClientId) {
      voyagesFiltrés = voyagesFiltrés.filter(vg => vg.clientId === this.selectedClientId);
    } else if (this.activeFilter === 'depot' && this.selectedDepotId) {
      voyagesFiltrés = voyagesFiltrés.filter(vg => vg.depotId === this.selectedDepotId);
    }
    
    this.filteredVoyages = voyagesFiltrés;
    
    // Si aucun tri manuel n'est actif, maintenir l'ordre par date décroissante
    if (!this.sortColumn) {
      this.filteredVoyages.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }
    
    this.updatePagination();
  }
  
  setFilter(filterType: 'all' | 'date' | 'client' | 'depot') {
    this.activeFilter = filterType;
    
    // Réinitialiser les filtres spécifiques quand on change de type
    if (filterType === 'all') {
      this.selectedDate = null;
      this.selectedClientId = null;
      this.selectedDepotId = null;
    } else if (filterType === 'date') {
      this.selectedClientId = null;
      this.selectedDepotId = null;
      // Initialiser avec la date d'aujourd'hui si aucune date n'est sélectionnée
      if (!this.selectedDate) {
        this.selectedDate = new Date().toISOString().split('T')[0];
      }
    } else if (filterType === 'client') {
      this.selectedDate = null;
      this.selectedDepotId = null;
    } else if (filterType === 'depot') {
      this.selectedDate = null;
      this.selectedClientId = null;
    }
    
    this.applyFilter();
  }
  
  // 🔥 Obtenir le nombre total de voyages du projet actif uniquement
  getTotalVoyagesProjet(): number {
    if (this.projetActifId) {
      return this.voyages.filter(vg => vg.projetId === this.projetActifId).length;
    }
    return this.voyages.length;
  }
  
  getFilterCount(filterType: 'date' | 'client' | 'depot'): number {
    let voyagesFiltrés = this.voyages;
    
    if (this.projetActifId) {
      voyagesFiltrés = voyagesFiltrés.filter(vg => vg.projetId === this.projetActifId);
    }
    
    if (filterType === 'date') {
      // Compter les voyages avec une date (voyages valides pour ce filtre)
      return voyagesFiltrés.filter(vg => vg.date).length;
    } else if (filterType === 'client') {
      // Compter les voyages avec un client
      return voyagesFiltrés.filter(vg => vg.clientId).length;
    } else if (filterType === 'depot') {
      // Compter les voyages avec un dépôt
      return voyagesFiltrés.filter(vg => vg.depotId).length;
    }
    
    return 0;
  }
  
  getTotalWeight(): number {
    return this.filteredVoyages.reduce((total, voyage) => {
      const poidsClient = voyage.poidsClient || 0;
      const poidsDepot = voyage.poidsDepot || 0;
      return total + poidsClient + poidsDepot;
    }, 0);
  }
  
  getTotalClientWeight(): number {
    return this.filteredVoyages.reduce((total, voyage) => {
      return total + (voyage.poidsClient || 0);
    }, 0);
  }
  
  getTotalDepotWeight(): number {
    return this.filteredVoyages.reduce((total, voyage) => {
      return total + (voyage.poidsDepot || 0);
    }, 0);
  }
  
  getTotalWeightLabel(): string {
    if (this.activeFilter === 'all') {
      return 'Total des voyages';
    } else if (this.activeFilter === 'date' && this.selectedDate) {
      // Formater la date en français avec indication de la plage horaire
      const date = new Date(this.selectedDate);
      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
      const dateFormatted = date.toLocaleDateString('fr-FR', options);
      
      // Date du lendemain pour affichage
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateFormatted = nextDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
      
      return `Total des voyages du ${dateFormatted} (7h) au ${nextDateFormatted} (7h)`;
    } else if (this.activeFilter === 'client' && this.selectedClientId) {
      const client = this.clients.find(c => c.id === this.selectedClientId);
      if (client) {
        return `Total des voyages pour ${client.nom} (${client.numero || 'N/A'})`;
      }
      return 'Total des voyages par client';
    } else if (this.activeFilter === 'depot' && this.selectedDepotId) {
      const depot = this.depots.find(d => d.id === this.selectedDepotId);
      if (depot) {
        return `Total des voyages pour le dépôt ${depot.nom}`;
      }
      return 'Total des voyages par dépôt';
    }
    return 'Total des voyages';
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
                // Trier par date décroissante (le plus récent en premier)
                this.sortVoyagesByDateDesc();
              } catch (e) {
                this.error = 'Erreur parsing: ' + e;
              }
              this.applyFilter();
              this.extractUniqueSocietes();
            };
            reader.readAsText(data);
          } else {
            this.voyages = data;
            // Trier par date décroissante (le plus récent en premier)
            this.sortVoyagesByDateDesc();
            this.applyFilter();
            this.extractUniqueSocietes();
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
                // Trier par date décroissante (le plus récent en premier)
                this.sortVoyagesByDateDesc();
              } catch (e) {
                this.error = 'Erreur parsing: ' + e;
              }
              this.applyFilter();
            };
            reader.readAsText(data);
        } else {
          this.voyages = data;
          // Trier par date décroissante (le plus récent en premier)
          this.sortVoyagesByDateDesc();
          this.applyFilter();
        }
        // Extraire toutes les sociétés uniques
        this.extractUniqueSocietes();
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }

  // Trier les voyages par date décroissante (le plus récent en premier)
  sortVoyagesByDateDesc(): void {
    this.voyages.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1; // Les voyages sans date vont à la fin
      if (!b.date) return -1;
      
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      
      // Ordre décroissant : le plus récent (dateB) avant l'ancien (dateA)
      return dateB - dateA;
    });
  }

  // Extraire toutes les sociétés uniques des voyages existants
  extractUniqueSocietes(): void {
    const societesSet = new Set<string>();
    this.voyages.forEach(voyage => {
      if (voyage.societe && voyage.societe.trim()) {
        societesSet.add(voyage.societe.trim());
      }
    });
    this.allSocietes = Array.from(societesSet).sort();
  }

  // Filtrer les sociétés selon l'input de recherche
  onSocieteSearchInput(): void {
    // Synchroniser avec dialogVoyage
    this.dialogVoyage.societe = this.societeSearchInput;
    
    const searchValue = this.societeSearchInput.trim().toLowerCase();
    
    // Nettoyer le timer existant
    if (this.societeDropdownTimer) {
      clearTimeout(this.societeDropdownTimer);
      this.societeDropdownTimer = null;
    }
    
    if (!searchValue) {
      this.filteredSocietes = this.allSocietes.slice(0, 10); // Afficher les 10 premières
      this.showSocieteDropdown = true;
      return;
    }
    
    // Filtrer les sociétés existantes
    this.filteredSocietes = this.allSocietes.filter(s => 
      s.toLowerCase().includes(searchValue)
    );
    
    this.showSocieteDropdown = true;
    
    // Si aucune société trouvée, démarrer un timer de 5 secondes pour fermer le popup
    if (this.filteredSocietes.length === 0 && searchValue) {
      this.societeDropdownTimer = setTimeout(() => {
        this.showSocieteDropdown = false;
        this.societeDropdownTimer = null;
      }, 500);
    }
  }

  // Sélectionner une société existante
  selectSociete(societe: string): void {
    this.dialogVoyage.societe = societe;
    this.societeSearchInput = societe;
    this.showSocieteDropdown = false;
    this.filteredSocietes = [];
  }

  // Réinitialiser la recherche de société
  resetSocieteSearch(): void {
    this.societeSearchInput = '';
    this.filteredSocietes = [];
    this.showSocieteDropdown = false;
    
    // Nettoyer le timer si existe
    if (this.societeDropdownTimer) {
      clearTimeout(this.societeDropdownTimer);
      this.societeDropdownTimer = null;
    }
  }

  // Filtrer les clients selon l'input de recherche (seulement les clients du projet actif)
  onClientSearchInput(): void {
    const searchValue = this.clientSearchInput.trim().toLowerCase();
    
    if (!searchValue) {
      this.filteredClientsSearch = [];
      this.showClientDropdown = false;
      return;
    }
    
    // Filtrer UNIQUEMENT les clients du projet actif (this.clients est déjà filtré par loadClients())
    this.filteredClientsSearch = this.clients.filter(client =>
      client.nom?.toLowerCase().includes(searchValue) ||
      client.numero?.toLowerCase().includes(searchValue)
    );
    
    this.showClientDropdown = true;
    
    console.log('🔍 Recherche client dans projet:', this.contextProjetId || this.projetActifId);
    console.log('📋 Clients disponibles:', this.clients.length);
    console.log('🎯 Résultats filtrés:', this.filteredClientsSearch.length);
  }

  // Sélectionner un client existant
  selectClient(client: ClientDTO): void {
    this.dialogVoyage.clientId = client.id;
    this.clientSearchInput = `${client.nom} (${client.numero || 'N/A'})`;
    this.showClientDropdown = false;
    this.filteredClientsSearch = [];
    this.updateResteEnTempsReel();
  }

  // Réinitialiser la recherche de client
  resetClientSearch(): void {
    this.clientSearchInput = '';
    this.filteredClientsSearch = [];
    this.showClientDropdown = false;
    this.dialogVoyage.clientId = undefined;
  }

  // Filtrer les dépôts selon l'input de recherche
  onDepotSearchInput(): void {
    const searchValue = this.depotSearchInput.trim().toLowerCase();
    
    if (!searchValue) {
      this.filteredDepotsSearch = [];
      this.showDepotDropdown = false;
      return;
    }
    
    // Filtrer les dépôts par nom
    this.filteredDepotsSearch = this.depots.filter(depot =>
      depot.nom?.toLowerCase().includes(searchValue)
    );
    
    this.showDepotDropdown = true;
  }

  // Sélectionner un dépôt existant
  selectDepot(depot: DepotDTO): void {
    this.dialogVoyage.depotId = depot.id;
    this.depotSearchInput = depot.nom || '';
    this.showDepotDropdown = false;
    this.filteredDepotsSearch = [];
    this.updateResteForDepot();
  }

  // Réinitialiser la recherche de dépôt
  resetDepotSearch(): void {
    this.depotSearchInput = '';
    this.filteredDepotsSearch = [];
    this.showDepotDropdown = false;
    this.dialogVoyage.depotId = undefined;
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

  exportToExcel(): void {
    // Préparer les données pour l'export
    const dataToExport = this.filteredVoyages.map(voyage => {
      // Trouver les noms plutôt que les IDs
      const chauffeur = this.chauffeurs.find(c => c.id === voyage.chauffeurId);
      const camion = this.camions.find(c => c.id === voyage.camionId);
      const client = this.clients.find(c => c.id === voyage.clientId);
      const depot = this.depots.find(d => d.id === voyage.depotId);
      const projet = this.projets.find(p => p.id === voyage.projetId);
      
      return {
        'N° Bon de Livraison': voyage.numBonLivraison || '',
        'N° Ticket': voyage.numTicket || '',
        'Date': voyage.date ? this.formatDateTime(voyage.date) : '',
        'Chauffeur': chauffeur?.nom || '',
        'Camion': camion?.matricule || '',
        'Société': voyage.societe || '',
        'Dépôt': depot?.nom || '',
        'Poids Dépôt (kg)': voyage.poidsDepot || 0,
        'Client': client?.nom || '',
        'N° Client': client?.numero || '',
        'Poids Client (kg)': voyage.poidsClient || 0,
        'Reste (kg)': voyage.reste || 0,
        'Projet': projet?.nom || ''
      };
    });

    // Créer une feuille de calcul
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);

    // Ajuster la largeur des colonnes
    const columnWidths = [
      { wch: 20 }, // N° Bon de Livraison
      { wch: 15 }, // N° Ticket
      { wch: 18 }, // Date avec heure
      { wch: 20 }, // Chauffeur
      { wch: 15 }, // Camion
      { wch: 20 }, // Société
      { wch: 20 }, // Dépôt
      { wch: 15 }, // Poids Dépôt
      { wch: 25 }, // Client
      { wch: 15 }, // N° Client
      { wch: 15 }, // Poids Client
      { wch: 12 }, // Reste
      { wch: 20 }  // Projet
    ];
    worksheet['!cols'] = columnWidths;

    // Créer un classeur
    const workbook: XLSX.WorkBook = {
      Sheets: { 'Voyages': worksheet },
      SheetNames: ['Voyages']
    };

    // Générer le nom du fichier avec la date actuelle
    const dateStr = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
    const fileName = `Voyages_${dateStr}.xlsx`;

    // Télécharger le fichier
    XLSX.writeFile(workbook, fileName);
  }

  // Formater la date pour l'affichage dans le tableau
  formatDateTime(date: string | undefined): string {
    if (!date) return '-';
    
    try {
      const dateObj = new Date(date);
      
      // Vérifier si la date est valide
      if (isNaN(dateObj.getTime())) return date;
      
      // Formater: JJ/MM/AAAA HH:mm
      const day = dateObj.getDate().toString().padStart(2, '0');
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const year = dateObj.getFullYear();
      const hours = dateObj.getHours().toString().padStart(2, '0');
      const minutes = dateObj.getMinutes().toString().padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      return date;
    }
  }
}
