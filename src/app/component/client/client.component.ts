import { Component } from '@angular/core';
import { ClientControllerService } from '../../api/api/clientController.service';
import { ProjetClientControllerService } from '../../api/api/projetClientController.service';
import { ProjetActifService } from '../../service/projet-actif.service';
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
    private projetActifService: ProjetActifService
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
    this.clientService.createClient(this.dialogClient, 'body').subscribe({
      next: (createdClient) => {
        let clientId: number | undefined;
        if (createdClient instanceof Blob) {
          createdClient.text().then(text => {
            try {
              const client = JSON.parse(text);
              clientId = client.id;
              this.createProjetClientRelation(clientId);
            } catch {}
          });
        } else {
          clientId = createdClient.id;
          this.createProjetClientRelation(clientId);
        }
        this.dialogClient = { nom: '', numero: '' };
        this.loadClients();
        this.closeDialog();
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  createProjetClientRelation(clientId?: number) {
    if (clientId && this.projetActifId) {
      const relation = { clientId, projetId: this.projetActifId };
      this.projetClientService.createProjetClient(relation, 'body').subscribe({
        next: (res) => {
          console.log('Relation projet-client créée:', res);
        },
        error: (err) => {
          this.error = 'Erreur association projet-client: ' + (err.error?.message || err.message);
          console.error('Erreur association projet-client:', err);
        }
      });
    }
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

  applyFilter() {
    const filter = this.clientFilter.trim().toLowerCase();
    let clientsFiltrés = this.clients;
    // Filtre par projet actif
    if (this.projetActifId) {
      clientsFiltrés = clientsFiltrés.filter(c => c.projetId === this.projetActifId);
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
}
