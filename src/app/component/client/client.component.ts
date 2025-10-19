import { Component } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ClientControllerService } from '../../api/api/clientController.service';
import { ProjetClientControllerService } from '../../api/api/projetClientController.service';
import { ProjetActifService } from '../../service/projet-actif.service';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { ClientDTO } from '../../api/model/clientDTO';
import { VoyageDTO } from '../../api/model/voyageDTO';
import { BreadcrumbItem } from '../breadcrumb/breadcrumb.component';
import { NotificationService } from '../../service/notification.service';
import { QuantiteService } from '../../service/quantite.service';
import { HttpClient } from '@angular/common/http';
import { Inject } from '@angular/core';
import { BASE_PATH } from '../../api/variables';

@Component({
  selector: 'app-client',
  templateUrl: './client.component.html',
  styleUrls: ['./client.component.css'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-out', style({ opacity: 0 }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'scale(0.8)', opacity: 0 }),
        animate('300ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ transform: 'scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-out', style({ transform: 'scale(0.8)', opacity: 0 }))
      ])
    ])
  ]
})
export class ClientComponent {
  clients: ClientDTO[] = [];
  filteredClients: ClientDTO[] = [];
  paginatedClients: ClientDTO[] = [];
  // Global active project (could be different from the project currently visited)
  projetActifId: number | null = null;
  projetActif: any = null;
  // Context project (projet consulté via parametre) stored in sessionStorage
  contextProjetId: number | null = null; 
  contextProjet: any = null;
  breadcrumbItems: BreadcrumbItem[] = []; 
  selectedClient: ClientDTO | null = null;
  newClient: ClientDTO = { nom: '', numero: '' };
  editMode: boolean = false;
  error: string = '';
  isSidebarOpen: boolean = true;
  showAddClient: boolean = false;
  clientFilter: string = '';
  dialogClient: ClientDTO = { nom: '', numero: '', adresse: '', mf: '' };
  
  // Pour l'autocomplétion type Select2
  allClients: ClientDTO[] = []; // Tous les clients (toutes les BDD)
  filteredSuggestions: ClientDTO[] = [];
  showSuggestions: boolean = false;
  selectedExistingClient: ClientDTO | null = null;
  
  // Voyages pour calculer le reste
  voyages: VoyageDTO[] = [];
  
  // Alerte temporaire
  showAlert: boolean = false;
  alertMessage: string = '';
  alertType: 'success' | 'danger' | 'warning' | 'info' = 'info';
  
  // Modal de quantité
  showQuantiteModal: boolean = false;
  quantiteAutorisee: number = 0;
  pendingClientId: number | null = null;
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageSizes: number[] = [5, 10, 20, 50];
  
  // Sorting
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Date Filter
  dateFilterActive: boolean = false;
  selectedDate: string | null = null;
  // Date max pour le filtre (aujourd'hui)
  today: string = '';
  
  // Expose Math to template
  Math = Math;

  constructor(
    private clientService: ClientControllerService,
    private projetClientService: ProjetClientControllerService,
    private projetActifService: ProjetActifService,
    private projetService: ProjetControllerService,
    private voyageService: VoyageControllerService,
    private notificationService: NotificationService,
    private quantiteService: QuantiteService,
    private http: HttpClient,
    @Inject(BASE_PATH) private basePath: string
  ) {
    // 🔥 Écouter les changements du projet actif
    this.projetActifService.projetActif$.subscribe(projet => {
      console.log('📡 Notification reçue du service - Nouveau projet:', projet);
      
      if (projet && projet.id) {
        const previousId = this.projetActifId;
        this.projetActifId = projet.id;
        this.projetActif = projet;
        
        // 🔥 FIX : Recharger si le projet change OU si c'est la première fois
        if (!previousId || previousId !== projet.id) {
          console.log('🔄 Rechargement des clients - previousId:', previousId, 'newId:', projet.id);
          // Attendre un peu pour que la navigation se termine
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
    // 1. Global active project
    const globalProjet = this.projetActifService.getProjetActif();
    if (globalProjet && globalProjet.id) {
      this.projetActifId = globalProjet.id;
      this.projetActif = globalProjet;
    }

    // 2. Context project (visited project via /projet/:id/parametre then navigation)
    const contextId = window.sessionStorage.getItem('projetActifId');
    if (contextId) {
      this.contextProjetId = Number(contextId);
      // Load context project details (can differ from global active)
      this.loadProjetDetails(this.contextProjetId, true);
    }

    this.loadAllClients(); // Charger tous les clients pour l'autocomplétion
    this.loadClients();
    this.loadVoyages(); // Charger les voyages pour calculer le reste
  }

  // 🔥 Méthode pour recharger toutes les données
  reloadData() {
    console.log('🔄 [Client] reloadData() - Projet actif:', this.projetActif?.nom, 'ID:', this.projetActifId);
    
    // 🔥 IMPORTANT : En mode rechargement, on utilise TOUJOURS le projet actif global
    // Le sessionStorage n'est utilisé QUE pour la navigation contextuelle (depuis /projet/:id/parametre)
    const currentUrl = window.location.pathname;
    const isOnParametrePage = currentUrl.includes('/parametre');
    
    if (isOnParametrePage) {
      // On est sur une page de paramètres, utiliser le contexte sessionStorage
      const contextId = window.sessionStorage.getItem('projetActifId');
      if (contextId) {
        const contextIdNumber = Number(contextId);
        console.log('📌 [Client] Page paramètre - Contexte:', contextIdNumber);
        this.contextProjetId = contextIdNumber;
        if (contextIdNumber !== this.projetActifId) {
          this.loadProjetDetails(this.contextProjetId, true);
        } else {
          this.contextProjet = this.projetActif;
        }
      }
    } else {
      // On n'est PAS sur une page de paramètres → Mode "Vue Projet Actif"
      // Ignorer le sessionStorage et utiliser le projet actif global
      console.log('🏠 [Client] Mode Vue Projet Actif - Projet:', this.projetActif?.nom);
      this.contextProjetId = null;
      this.contextProjet = null;
    }
    
    // Recharger toutes les données
    this.loadAllClients();
    this.loadClients();
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

  updateBreadcrumb() {
    const projet = this.contextProjet || this.projetActif;
    if (projet) {
      this.breadcrumbItems = [
        { label: 'Projets', url: '/projet' },
        { label: projet.nom || `Projet ${projet.id}`, url: `/projet/${projet.id}/parametre` },
        { label: 'Paramètres', url: `/projet/${projet.id}/parametre` },
        { label: 'Clients' }
      ];
    } else {
      this.breadcrumbItems = [
        { label: 'Clients' }
      ];
    }
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

  openAddDialog() {
    this.dialogClient = { nom: '', numero: '', adresse: '', mf: '' };
    this.selectedExistingClient = null;
    this.showAddClient = true;
    this.editMode = false;
    this.showSuggestions = false;
    this.filteredSuggestions = [];
  }
  
  // Charger tous les clients de la base de données
  loadAllClients() {
    this.clientService.getAllClients('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const parsed = JSON.parse(text);
            this.allClients = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            this.allClients = [];
          }
        } else {
          this.allClients = Array.isArray(data) ? data : [];
        }
      },
      error: (err) => {
        console.error('Erreur chargement tous les clients:', err);
        this.allClients = [];
      }
    });
  }
  
  // Filtrer les suggestions lors de la saisie
  onClientInputChange(field: 'nom' | 'numero') {
    const searchValue = field === 'nom' ? this.dialogClient.nom : this.dialogClient.numero;
    
    if (!searchValue || searchValue.trim().length < 2) {
      this.showSuggestions = false;
      this.filteredSuggestions = [];
      this.selectedExistingClient = null;
      return;
    }
    
    const searchLower = searchValue.trim().toLowerCase();
    
    // Filtrer les clients qui correspondent et qui ne sont PAS déjà dans le projet actuel
    const targetProjetId = this.contextProjetId || this.projetActifId;
    this.filteredSuggestions = this.allClients.filter(client => {
      // Vérifier si le client correspond à la recherche
      const nomMatch = client.nom?.toLowerCase().includes(searchLower);
      const numeroMatch = client.numero?.toLowerCase().includes(searchLower);
      const matchesSearch = nomMatch || numeroMatch;
      
      // Vérifier si le client n'est pas déjà dans le projet
      const notInProject = !this.clients.some(c => c.id === client.id);
      
      return matchesSearch && notInProject;
    }).slice(0, 10); // Limiter à 10 suggestions
    
    this.showSuggestions = this.filteredSuggestions.length > 0;
    this.selectedExistingClient = null;
  }
  
  // Sélectionner un client existant depuis les suggestions
  selectSuggestion(client: ClientDTO) {
    this.selectedExistingClient = client;
    this.dialogClient.nom = client.nom || '';
    this.dialogClient.numero = client.numero || '';
    this.dialogClient.adresse = client.adresse || '';
    this.dialogClient.mf = client.mf || '';
    this.showSuggestions = false;
    this.filteredSuggestions = [];
  }
  
  // Fermer les suggestions si on clique ailleurs
  closeSuggestions() {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 200);
  }

  

  selectClient(cl: ClientDTO) {
    this.dialogClient = {
      id: cl.id,
      nom: cl.nom,
      numero: cl.numero,
      adresse: cl.adresse,
      mf: cl.mf,
      quantitesAutoriseesParProjet: cl.quantitesAutoriseesParProjet
    };
    this.selectedClient = cl;
    this.editMode = true;
    this.showAddClient = true;
  }

  // Helper: retourne aujourd'hui au format yyyy-MM-dd (heure locale)
  private getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth()+1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  addDialogClient() {
    if (!this.dialogClient.nom || !this.dialogClient.numero) {
      this.error = 'Veuillez remplir tous les champs.';
      return;
    }
    
    const targetProjetId = this.contextProjetId || this.projetActifId;
    console.log('🔵 addDialogClient() - targetProjetId:', targetProjetId, 'contextProjetId:', this.contextProjetId, 'projetActifId:', this.projetActifId);
    
    if (!targetProjetId) {
      this.showTemporaryAlert(
        'Aucun projet actif. Veuillez d\'abord sélectionner un projet.',
        'danger'
      );
      return;
    }
    
    // Si un client existant a été sélectionné, on l'associe au projet
    if (this.selectedExistingClient && this.selectedExistingClient.id) {
      // Vérifier si le client est déjà associé à ce projet
      const isAlreadyInProject = this.clients.some(c => c.id === this.selectedExistingClient!.id);
      
      if (isAlreadyInProject) {
        this.showTemporaryAlert(
          'Ce client est déjà associé à ce projet.',
          'warning'
        );
        this.closeDialog();
        return;
      }
      
      console.log('✅ Association client existant:', this.selectedExistingClient.id, 'au projet:', targetProjetId);
      // Associer le client existant au projet
      this.askQuantiteAndAssociate(this.selectedExistingClient.id);
      this.dialogClient = { nom: '', numero: '', adresse: '', mf: '' };
      this.closeDialog();
      return;
    }
    
    // Sinon, créer un nouveau client (SANS projetId - l'association se fait via ProjetClient)
    console.log('🆕 Création nouveau client:', this.dialogClient.nom, 'pour le projet:', targetProjetId);
   
    this.clientService.createClient(this.dialogClient, 'body').subscribe({
      next: (createdClient) => {
        console.log('✅ Client créé:', createdClient);
    
        let clientId: number | undefined;
        if (createdClient instanceof Blob) {
          createdClient.text().then(text => {
            try {
              const client = JSON.parse(text);
              clientId = client.id;
              console.log('➡️ Association client', clientId, 'au projet', targetProjetId);
              // Fermer le dialogue d'ajout AVANT d'ouvrir la modal quantité
              this.dialogClient = { nom: '', numero: '', adresse: '', mf: '' };
              this.closeDialog();
              // Ouvrir la modal quantité
              this.askQuantiteAndAssociate(clientId);
            } catch (e) { 
              console.error('❌ Erreur parsing client:', e); 
            }
          });
        } else {
          clientId = createdClient.id;
          console.log('➡️ Association client', clientId, 'au projet', targetProjetId);
          // Fermer le dialogue d'ajout AVANT d'ouvrir la modal quantité
          this.dialogClient = { nom: '', numero: '', adresse: '', mf: '' };
          this.closeDialog();
          // Ouvrir la modal quantité
          this.askQuantiteAndAssociate(clientId);
        }
      },
      error: (err) => {
        console.error('❌ Erreur création client:', err);
        this.error = 'Erreur ajout: ' + (err.error?.message || err.message);
      }
    });
  }

  // Ask user for quantiteAutorisee and then associate using ProjetController endpoint
  askQuantiteAndAssociate(clientId?: number) {
    const targetProjetId = this.contextProjetId || this.projetActifId;
 
    if (!clientId || !targetProjetId) return;
    
    // Ouvrir la modal personnalisée au lieu du prompt système
    this.pendingClientId = clientId;
    this.quantiteAutorisee = 0;
    this.showQuantiteModal = true;
  }
  
  // Confirmer l'ajout du client avec la quantité saisie
  confirmQuantiteAndAssociate() {
    const targetProjetId = this.contextProjetId || this.projetActifId;
    const clientId = this.pendingClientId;
    
    console.log('🔗 confirmQuantiteAndAssociate() - Projet:', targetProjetId, 'Client:', clientId, 'Quantité:', this.quantiteAutorisee);
    
    if (!clientId || !targetProjetId) {
      console.error('❌ Données manquantes - clientId:', clientId, 'targetProjetId:', targetProjetId);
      this.showTemporaryAlert('Erreur: Données manquantes pour l\'association.', 'danger');
      return;
    }
    
    const quantite = Number(this.quantiteAutorisee) || 0;
    const body = { quantiteAutorisee: quantite };
    
    console.log('📤 Appel API addClientToProjet avec body:', body);
    
    this.projetService.addClientToProjet(targetProjetId, clientId, body).subscribe({
      next: (res) => {
        console.log('✅ Association créée avec succès:', res);
        
        // Fermer la modal
        this.closeQuantiteModal();
        
        // Afficher un message de succès
        const projet = this.contextProjet || this.projetActif;
        const nomProjet = projet?.nom || `Projet ${targetProjetId}`;
        this.showTemporaryAlert(
          `Le client a été ajouté avec succès au projet "${nomProjet}" avec une quantité autorisée de ${quantite}.`,
          'success'
        );
        // Recharger la liste après l'association réussie
        this.loadClients();
        this.loadVoyages(); // Recharger les voyages pour mettre à jour le reste
      },
      error: async (err) => {
        console.error('Erreur association client-projet:', err);
        console.error('err.status:', err.status);
        console.error('err.error:', err.error);
        console.error('err.message:', err.message);
        
        // Extraire le message d'erreur de différentes sources possibles
        let errorMsg = '';
        
        // Si l'erreur est un Blob, le parser
        if (err.error instanceof Blob) {
          try {
            const text = await err.error.text();
            console.log('Blob text:', text);
            if (text && text.trim()) {
              errorMsg = text;
            }
          } catch (e) {
            console.error('Erreur parsing blob:', e);
          }
        } else if (err.error) {
          if (typeof err.error === 'string') {
            errorMsg = err.error;
          } else if (err.error.message) {
            errorMsg = err.error.message;
          } else if (err.error.error) {
            errorMsg = err.error.error;
          }
        }
        
        console.log('Message d\'erreur extrait:', errorMsg);
        
        // Si c'est un 400 ou 403, c'est probablement un dépassement de quantité
        // car le backend rejette avec IllegalArgumentException
        if (err.status === 400 || err.status === 403) {
          console.log(`Erreur ${err.status} détectée - Dépassement de quantité probable`);
          
          // Fermer la modal de quantité
          this.closeQuantiteModal();
          
          // Récupérer les informations du projet pour afficher un message détaillé
          const projet = this.contextProjet || this.projetActif;
          
          if (projet && targetProjetId) {
            // Récupérer la quantité restante
            this.quantiteService.getQuantiteRestante(targetProjetId).subscribe({
              next: (quantiteRestante) => {
                const nomProjet = projet.nom || `Projet ${targetProjetId}`;
                const alertMsg = `Impossible d'ajouter le client : la quantité autorisée dépasse la quantité restante.\n\n` +
                                 `📊 Projet "${nomProjet}" :\n` +
                                 `✅ Quantité restante disponible : ${quantiteRestante.toFixed(2)}`;
                
                // Afficher l'alerte temporaire
                this.showTemporaryAlert(alertMsg, 'danger');
              },
              error: () => {
                // Si on ne peut pas récupérer la quantité, utiliser un message par défaut ou le message d'erreur du backend
                const nomProjet = projet.nom || `Projet ${targetProjetId}`;
                const alertMsg = errorMsg && errorMsg.trim() 
                  ? errorMsg 
                  : `Impossible d'ajouter le client au projet "${nomProjet}" : la quantité autorisée dépasse la quantité restante.`;
                
                console.log('🚨 Affichage alerte d\'erreur:', alertMsg);
                this.showTemporaryAlert(alertMsg, 'danger');
              }
            });
          } else {
            // Pas d'info projet disponible
            const alertMsg = errorMsg && errorMsg.trim() 
              ? errorMsg 
              : 'Impossible d\'ajouter le client : la quantité autorisée dépasse la quantité restante du projet.';
            
            this.showTemporaryAlert(alertMsg, 'danger');
          }
          
          // Rafraîchir les notifications pour afficher la nouvelle notification créée par le backend
          console.log('Rafraîchissement des notifications');
          this.notificationService.rafraichir();
          
          // Supprimer le client créé orphelin si nécessaire
          if (clientId) {
            console.log('Suppression du client orphelin:', clientId);
            this.clientService.deleteClient(clientId).subscribe({
              next: () => console.log('Client orphelin supprimé'),
              error: (delErr) => console.error('Erreur suppression client orphelin:', delErr)
            });
          }
        } else {
          // Fermer la modal de quantité pour les autres erreurs aussi
          this.closeQuantiteModal();
          
          // Autre type d'erreur
          const displayMsg = errorMsg || err.message || 'Erreur inconnue';
          this.error = 'Erreur association client-projet: ' + displayMsg;
        }
        
        // Recharger la liste des clients
        this.loadClients();
        this.loadVoyages(); // Recharger les voyages pour mettre à jour le reste
      }
    });
  }

  updateDialogClient() {
    if (!this.dialogClient?.id) return;
    this.clientService.updateClient(this.dialogClient.id, this.dialogClient, 'body').subscribe({
      next: () => {
        this.dialogClient = { nom: '', numero: '', adresse: '', mf: '' };
        this.selectedClient = null;
        this.editMode = false;
        this.loadClients();
        this.loadVoyages(); // Recharger les voyages pour mettre à jour le reste
        this.closeDialog();
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
  }

  closeDialog() {
    this.showAddClient = false;
    this.editMode = false;
    this.dialogClient = { nom: '', numero: '', adresse: '', mf: '' };
    this.selectedClient = null;
    this.error = '';
  }

  loadClients() {
    const targetProjetId = this.contextProjetId || this.projetActifId;
    console.log('📊 loadClients() - contextProjetId:', this.contextProjetId, 'projetActifId:', this.projetActifId, 'targetProjetId:', targetProjetId);
    
    if (!targetProjetId) {
      console.warn('⚠️ Aucun projet actif - liste des clients vide');
      this.clients = [];
      this.applyFilter();
      return;
    }
    
    // TOUJOURS charger via l'endpoint spécifique au projet pour garantir le filtrage
    const url = `${this.basePath}/api/clients/projet/${targetProjetId}`;
    console.log('📤 Appel endpoint projet-clients:', url);
    
    this.http.get<any[]>(url, { withCredentials: true, responseType: 'json' as 'json' }).subscribe({
      next: (data) => {
        console.log('✅ Réponse getClientsByProjet:', data);
        if (Array.isArray(data)) {
          this.clients = data;
          console.log(`✅ ${data.length} clients chargés pour le projet ${targetProjetId}`);
        } else {
          this.clients = [];
          console.warn('⚠️ Réponse non-array:', data);
        }
        this.applyFilter();
      },
      error: err => {
        console.error('❌ Erreur chargement clients pour projet:', err);
        this.error = 'Erreur chargement des clients: ' + (err.error?.message || err.message);
        this.clients = [];
        this.applyFilter();
      }
    });
  }

  applyFilter() {
    const filter = this.clientFilter.trim().toLowerCase();
    let clientsFiltrés = this.clients;
    // Filtre par projet actif
    const targetProjetId = this.contextProjetId || this.projetActifId;
    if (targetProjetId) {
      clientsFiltrés = clientsFiltrés.filter((c: any) => c.projetId === targetProjetId || c.projetId === undefined);
    }
    // Filtre par texte
    if (filter) {
      clientsFiltrés = clientsFiltrés.filter(c =>
        (c.nom?.toLowerCase().includes(filter) || false) ||
        (c.numero?.toLowerCase().includes(filter) || false)
      );
    }
    this.filteredClients = clientsFiltrés;
    this.currentPage = 1;
    this.updatePagination();
  }

  // Sorting methods
  sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortClients();
  }

  sortClients() {
    this.filteredClients.sort((a: any, b: any) => {
      let aVal = a[this.sortColumn];
      let bVal = b[this.sortColumn];
      
      if (this.sortColumn === 'quantite') {
        aVal = this.getQuantitePourProjet(a) || 0;
        bVal = this.getQuantitePourProjet(b) || 0;
      }
      
      if (this.sortColumn === 'quantiteVendue') {
        aVal = this.getTotalLivreClient(a.id);
        bVal = this.getTotalLivreClient(b.id);
      }
      
      if (this.sortColumn === 'reste') {
        aVal = this.getResteClient(a);
        bVal = this.getResteClient(b);
      }
      
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    this.updatePagination();
  }

  // Pagination methods
  updatePagination() {
    this.totalPages = Math.ceil(this.filteredClients.length / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
    }
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedClients = this.filteredClients.slice(startIndex, endIndex);
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  deleteClient(id?: number) {
    if (id === undefined) return;
    this.clientService.deleteClient(id, 'body').subscribe({
      next: () => {
        this.loadClients();
        this.loadVoyages(); // Recharger les voyages pour mettre à jour le reste
      },
      error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
    });
  }

  cancelEdit() {
    this.selectedClient = null;
    this.editMode = false;
  }

  // Charger les voyages pour le projet actif
  loadVoyages() {
    const targetProjetId = this.contextProjetId || this.projetActifId;
    if (!targetProjetId) {
      this.voyages = [];
      return;
    }
    
    this.voyageService.getVoyagesByProjet(targetProjetId, 'body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const parsed = JSON.parse(text);
            this.voyages = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            this.voyages = [];
          }
        } else {
          this.voyages = Array.isArray(data) ? data : [];
        }
      },
      error: (err) => {
        console.error('Erreur chargement voyages:', err);
        this.voyages = [];
      }
    });
  }

  // Récupère la quantité autorisée pour le projet actif depuis la map renvoyée par le backend
  getQuantitePourProjet(client: any): number | undefined {
    if (!this.projetActifId || !client) return undefined;
    if (client.quantitesAutoriseesParProjet) {
      return client.quantitesAutoriseesParProjet[this.projetActifId];
    }
    // fallback si jamais la structure change
    return (client.quantiteAutorisee !== undefined) ? client.quantiteAutorisee : undefined;
  }
  
  // Calculer le total livré pour un client
  getTotalLivreClient(clientId?: number): number {
    if (!clientId || !this.voyages) return 0;
    
    let filteredVoyages = this.voyages.filter(v => v.clientId === clientId && v.poidsClient);
    
    // Si un filtre de date est actif, filtrer dans la fenêtre [07:00 du jour, 06:00 du lendemain)
    if (this.dateFilterActive && this.selectedDate) {
      const selectedDateObj = new Date(this.selectedDate + 'T00:00:00');
      const startWorkDay = new Date(selectedDateObj);
      startWorkDay.setHours(7, 0, 0, 0);
      const endWorkDay = new Date(selectedDateObj);
      endWorkDay.setDate(endWorkDay.getDate() + 1);
      endWorkDay.setHours(6, 0, 0, 0);
      
      filteredVoyages = filteredVoyages.filter(v => {
        if (!v.date) return false;
        const voyageDateTime = new Date(v.date);
        return voyageDateTime >= startWorkDay && voyageDateTime < endWorkDay;
      });
    }
    
    return filteredVoyages.reduce((sum, v) => sum + (v.poidsClient || 0), 0);
  }
  
  // Calculer le reste pour un client
  getResteClient(client: any): number {
    if (!client || !client.id) return 0;
    const quantiteAutorisee = this.getQuantitePourProjet(client) || 0;
    const totalLivre = this.getTotalLivreClient(client.id);
    return quantiteAutorisee - totalLivre;
  }
  
  // Obtenir la couleur selon le reste
  getResteColor(reste: number, quantiteAutorisee: number): string {
    if (quantiteAutorisee === 0) return '#64748b'; // Gris si pas de limite
    const percentage = (reste / quantiteAutorisee) * 100;
    if (percentage > 50) return '#10b981'; // Vert
    if (percentage > 20) return '#f59e0b'; // Orange
    return '#ef4444'; // Rouge
  }

  // Affiche une alerte temporaire pendant 1 minute
  showTemporaryAlert(message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'info') {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;
    
    // Masquer l'alerte après 1 minute (60000 ms)
    setTimeout(() => {
      this.showAlert = false;
      this.alertMessage = '';
    }, 60000);
  }

  // Retourne le titre selon le type d'alerte
  getAlertTitle(): string {
    switch (this.alertType) {
      case 'success': return 'Succès !';
      case 'danger': return 'Erreur !';
      case 'warning': return 'Attention !';
      case 'info': return 'Information';
      default: return 'Notification';
    }
  }

  // Ferme l'alerte manuellement
  closeAlert() {
    this.showAlert = false;
    this.alertMessage = '';
  }
  
  // Annuler l'ajout du client et supprimer le client créé
  cancelQuantiteModal() {
    if (this.pendingClientId) {
      // Supprimer le client qui a été créé
      this.clientService.deleteClient(this.pendingClientId, 'body').subscribe({
        next: () => {
          console.log('Client supprimé après annulation');
          this.loadClients();
          this.loadVoyages();
        },
        error: (err) => {
          console.error('Erreur lors de la suppression du client:', err);
        }
      });
    }
    
    // Fermer la modal
    this.showQuantiteModal = false;
    this.pendingClientId = null;
    this.quantiteAutorisee = 0;
  }
  
  // Fermer la modal de quantité sans supprimer
  closeQuantiteModal() {
    this.showQuantiteModal = false;
    this.pendingClientId = null;
    this.quantiteAutorisee = 0;
  }
  
  // Activer/désactiver le filtre par date
  toggleDateFilter() {
    this.dateFilterActive = !this.dateFilterActive;
    if (this.dateFilterActive && !this.selectedDate) {
      // Initialiser avec la date d'aujourd'hui (locale)
      this.selectedDate = this.today;
    }
    this.updatePagination();
  }
  
  // Gérer le changement de date
  onDateFilterChange() {
    // Clamp future dates
    if (this.selectedDate && this.today && this.selectedDate > this.today) {
      this.selectedDate = this.today;
    }
    // Relancer le filtrage ou au moins la pagination
    this.applyFilter();
    this.updatePagination();
  }
  
  // Effacer le filtre par date
  clearDateFilter() {
    this.dateFilterActive = false;
    this.selectedDate = null;
    this.updatePagination();
  }
  
  // Formater la date en français
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('fr-FR', options);
  }
}
