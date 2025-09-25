import { Component } from '@angular/core';
import { ClientControllerService } from '../../api/api/clientController.service';
import { ClientDTO } from '../../api/model/clientDTO';

@Component({
  selector: 'app-client',
  templateUrl: './client.component.html',
  styleUrls: ['./client.component.css']
})
export class ClientComponent {
  clients: ClientDTO[] = [];
  filteredClients: ClientDTO[] = [];
  selectedClient: ClientDTO | null = null;
  newClient: ClientDTO = { nom: '', numero: '' };
  editMode: boolean = false;
  error: string = '';
  isSidebarOpen: boolean = true;
  showAddClient: boolean = false;
  clientFilter: string = '';
  dialogClient: ClientDTO = { nom: '', numero: '' };

  constructor(private clientService: ClientControllerService) {
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
    this.clientService.createClient(this.dialogClient, 'body').subscribe({
      next: () => {
        this.dialogClient = { nom: '', numero: '' };
        this.loadClients();
        this.closeDialog();
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
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
    if (!filter) {
      this.filteredClients = this.clients;
    } else {
      this.filteredClients = this.clients.filter(c =>
        (c.nom?.toLowerCase().includes(filter) || false) ||
        (c.numero?.toLowerCase().includes(filter) || false)
      );
    }
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
