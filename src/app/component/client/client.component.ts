import { Component } from '@angular/core';
import { ClientControllerService } from '../../api/api/clientController.service';
import { ProjetClientControllerService } from '../../api/api/projetClientController.service';
import { ProjetActifService } from '../../service/projet-actif.service';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { ClientDTO } from '../../api/model/clientDTO';

@Component({
  selector: 'app-client',
  templateUrl: './client.component.html',
  styleUrls: ['./client.component.css']
})
export class ClientComponent {
  isProjetActif(): boolean {
    // À adapter selon la structure du projet actif
    // Ici, on suppose que projetActifId est défini et que le projet est actif
    // Vous pouvez enrichir la logique avec un service ou une propriété 'active'
    return !!this.projetActifId; // Remplacez par la vraie condition si besoin
  }
  clients: ClientDTO[] = [];
  filteredClients: ClientDTO[] = [];
  projetActifId: number | null = null;
  selectedClient: ClientDTO | null = null;
  newClient: ClientDTO = { nom: '', numero: '' };
  editMode: boolean = false;
  error: string = '';
  isSidebarOpen: boolean = true;
  showAddClient: boolean = false;
  clientFilter: string = '';
  dialogClient: ClientDTO = { nom: '', numero: '' };

  constructor(
    private clientService: ClientControllerService,
    private projetClientService: ProjetClientControllerService,
    private projetActifService: ProjetActifService,
    private projetService: ProjetControllerService
  ) {
    this.loadProjetActif();
  }

  loadProjetActif() {
    // Récupère le projet actif depuis le service
    const projet = this.projetActifService.getProjetActif();
    if (projet && projet.id) {
      this.projetActifId = projet.id;
    } else {
      // Fallback sur sessionStorage si besoin
      const projetActif = window.sessionStorage.getItem('projetActifId');
      if (projetActif) {
        this.projetActifId = Number(projetActif);
      }
    }
    console.log('loadProjetActif() - projetActifId:', this.projetActifId);
    this.loadClients();
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
    if (this.projetActifId) {
      this.dialogClient.projetId = this.projetActifId;
    }
    console.log('Creating client - payload:', this.dialogClient, 'projetActifId:', this.projetActifId);
    this.clientService.createClient(this.dialogClient, 'body').subscribe({
      next: (createdClient) => {
        console.log('createClient response (raw):', createdClient);
        let clientId: number | undefined;
        if (createdClient instanceof Blob) {
          createdClient.text().then(text => {
            try {
              const client = JSON.parse(text);
              console.log('createClient parsed blob:', client);
              clientId = client.id;
              this.askQuantiteAndAssociate(clientId);
            } catch (e) { console.error(e); }
          });
        } else {
          clientId = createdClient.id;
          console.log('createClient json result:', createdClient);
          this.askQuantiteAndAssociate(clientId);
        }
        this.dialogClient = { nom: '', numero: '' };
        this.loadClients();
        this.closeDialog();
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  // Ask user for quantiteAutorisee and then associate using ProjetController endpoint
  askQuantiteAndAssociate(clientId?: number) {
    console.log('askQuantiteAndAssociate - clientId:', clientId, 'projetActifId:', this.projetActifId);
    if (!clientId || !this.projetActifId) return;
    // Simple prompt to get quantity; replace with a proper modal if desired
    const input = window.prompt('Quantité autorisée pour ce client sur le projet actif (laisser vide = 0):', '0');
    let quantite = 0;
    if (input !== null && input !== undefined && input !== '') {
      const parsed = Number(input);
      if (!isNaN(parsed)) quantite = parsed;
    }
    const body = { quantiteAutorisee: quantite };
    this.projetService.addClientToProjet(this.projetActifId, clientId, body).subscribe({
      next: (res) => console.log('Client associé au projet avec quantite:', res),
      error: (err) => {
        this.error = 'Erreur association client-projet: ' + (err.error?.message || err.message);
        console.error('Erreur association client-projet:', err);
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
    console.log('loadClients() - projetActifId:', this.projetActifId);
    // If we have an active project id, prefer the backend endpoint that returns clients for that project
    if (this.projetActifId) {
      this.clientService.getClientsByProjet(this.projetActifId, 'body').subscribe({
        next: async (data) => {
          if (data instanceof Blob) {
            const text = await data.text();
            console.log('getClientsByProjet - blob text:', text);
            try {
              const json = JSON.parse(text);
              console.log('getClientsByProjet - parsed json:', json);
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
            console.log('getClientsByProjet - json array, length:', data.length);
            this.clients = data;
          } else {
            console.log('getClientsByProjet - unexpected response:', data);
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
                    this.clients = json.filter((c: any) => c.projetId === this.projetActifId);
                  } else {
                    this.clients = [];
                  }
                } catch (e) {
                  this.error = 'Erreur parsing JSON: ' + e;
                  this.clients = [];
                }
              } else if (Array.isArray(data2)) {
                this.clients = data2.filter(c => c.projetId === this.projetActifId);
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
    if (this.projetActifId) {
      // Les clients retournés par getClientsByProjet peuvent ne pas avoir 'projetId' directement.
      // On conserve donc tous les clients si on a utilisé l'endpoint projet-spécifique (absence de projetId)
      // ou on filtre ceux qui ont explicitement le bon projetId.
      clientsFiltrés = clientsFiltrés.filter((c: any) => c.projetId === this.projetActifId || c.projetId === undefined);
    }
    // Filtre par texte
    if (filter) {
      clientsFiltrés = clientsFiltrés.filter(c =>
        (c.nom?.toLowerCase().includes(filter) || false) ||
        (c.numero?.toLowerCase().includes(filter) || false)
      );
    }
    this.filteredClients = clientsFiltrés;
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
}
