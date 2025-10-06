import { Component } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ClientControllerService } from '../../api/api/clientController.service';
import { ProjetClientControllerService } from '../../api/api/projetClientController.service';
import { ProjetActifService } from '../../service/projet-actif.service';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { ClientDTO } from '../../api/model/clientDTO';
import { BreadcrumbItem } from '../breadcrumb/breadcrumb.component';
import { NotificationService } from '../../service/notification.service';
import { QuantiteService } from '../../service/quantite.service';

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
  dialogClient: ClientDTO = { nom: '', numero: '' };
  
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
  
  // Expose Math to template
  Math = Math;

  constructor(
    private clientService: ClientControllerService,
    private projetClientService: ProjetClientControllerService,
    private projetActifService: ProjetActifService,
    private projetService: ProjetControllerService,
    private notificationService: NotificationService,
    private quantiteService: QuantiteService
  ) {
    this.initializeProjetContext();
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

   
    this.loadClients();
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
    this.dialogClient = { nom: '', numero: '' };
    this.showAddClient = true;
    this.editMode = false;
  }

  selectClient(cl: ClientDTO) {
    this.dialogClient = { ...cl };
    this.selectedClient = cl;
    this.editMode = true;
    this.showAddClient = false;
  }

  addDialogClient() {
    if (!this.dialogClient.nom || !this.dialogClient.numero) {
      this.error = 'Veuillez remplir tous les champs.';
      return;
    }
    // Associe le projet actif
    const targetProjetId = this.contextProjetId || this.projetActifId;
    if (targetProjetId) {
      this.dialogClient.projetId = targetProjetId;
    }
   
    this.clientService.createClient(this.dialogClient, 'body').subscribe({
      next: (createdClient) => {
    
        let clientId: number | undefined;
        if (createdClient instanceof Blob) {
          createdClient.text().then(text => {
            try {
              const client = JSON.parse(text);
             
              clientId = client.id;
              this.askQuantiteAndAssociate(clientId);
            } catch (e) { console.error(e); }
          });
        } else {
          clientId = createdClient.id;
         
          this.askQuantiteAndAssociate(clientId);
        }
        this.dialogClient = { nom: '', numero: '' };
        this.closeDialog();
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
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
    
    if (!clientId || !targetProjetId) return;
    
    const quantite = Number(this.quantiteAutorisee) || 0;
    const body = { quantiteAutorisee: quantite };
    this.projetService.addClientToProjet(targetProjetId, clientId, body).subscribe({
      next: (res) => {
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
        
        // Si c'est un 403, c'est probablement un dépassement de quantité
        // car le backend rejette avec IllegalArgumentException qui devient 403
        if (err.status === 403) {
          console.log('Erreur 403 détectée - Dépassement de quantité probable');
          
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
                // Si on ne peut pas récupérer la quantité, utiliser un message par défaut
                const nomProjet = projet.nom || `Projet ${targetProjetId}`;
                const alertMsg = errorMsg && errorMsg.trim() 
                  ? errorMsg 
                  : `Impossible d'ajouter le client au projet "${nomProjet}" : la quantité autorisée dépasse la quantité restante.`;
                
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
      }
    });
  }

  updateDialogClient() {
    if (!this.dialogClient?.id) return;
    this.clientService.updateClient(this.dialogClient.id, this.dialogClient, 'body').subscribe({
      next: () => {
        this.dialogClient = { nom: '', numero: '' };
        this.selectedClient = null;
        this.editMode = false;
        this.loadClients();
        this.closeDialog();
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
  }

  closeDialog() {
    this.showAddClient = false;
    this.editMode = false;
    this.dialogClient = { nom: '', numero: '' };
    this.selectedClient = null;
    this.error = '';
  }

  loadClients() {
    const targetProjetId = this.contextProjetId || this.projetActifId;
    if (targetProjetId) {
      this.clientService.getClientsByProjet(targetProjetId, 'body').subscribe({
        next: async (data) => {
          if (data instanceof Blob) {
            const text = await data.text();
            try {
              const json = JSON.parse(text);
              if (Array.isArray(json)) {
                this.clients = json;
              } else {
                this.clients = [];
              }
            } catch (e) {
              this.error = 'Erreur parsing JSON: ' + e;
              this.clients = [];
            }
          } else if (Array.isArray(data)) {
            this.clients = data;
          } else {
            this.clients = [];
          }
          this.applyFilter();
        },
        error: (err) => {
          // fallback to fetching all and filtering client-side
          console.warn('getClientsByProjet failed, falling back to getAllClients', err);
          this.clientService.getAllClients('body').subscribe({
            next: async (data2) => {
              if (data2 instanceof Blob) {
                const text = await data2.text();
                try {
                  const json = JSON.parse(text);
                  if (Array.isArray(json)) {
                    this.clients = json.filter((c: any) => c.projetId === targetProjetId);
                  } else {
                    this.clients = [];
                  }
                } catch (e) {
                  this.error = 'Erreur parsing JSON: ' + e;
                  this.clients = [];
                }
              } else if (Array.isArray(data2)) {
                this.clients = data2.filter(c => c.projetId === targetProjetId);
              } else {
                this.clients = [];
              }
              this.applyFilter();
            },
            error: (err2) => this.error = 'Erreur chargement: ' + (err2.error?.message || err2.message)
          });
        }
      });
    } else {
      // No active project: fetch all clients
      this.clientService.getAllClients('body').subscribe({
        next: async (data) => {
          if (data instanceof Blob) {
            const text = await data.text();
            try {
              const json = JSON.parse(text);
              if (Array.isArray(json)) {
                this.clients = json;
              } else {
                this.clients = [];
              }
            } catch (e) {
              this.error = 'Erreur parsing JSON: ' + e;
              this.clients = [];
            }
          } else if (Array.isArray(data)) {
            this.clients = data;
          } else {
            this.clients = [];
          }
          this.applyFilter();
        },
        error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
      });
    }
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
      },
      error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
    });
  }

  cancelEdit() {
    this.selectedClient = null;
    this.editMode = false;
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
}
