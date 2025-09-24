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
  selectedClient: ClientDTO | null = null;
  newClient: ClientDTO = { nom: '', numero: '' };
  editMode: boolean = false;
  error: string = '';

  constructor(private clientService: ClientControllerService) {
    this.loadClients();
  }

  addClient() {
    this.clientService.createClient(this.newClient, 'body').subscribe({
      next: () => {
        this.newClient = { nom: '', numero: '' };
        this.loadClients();
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }
  loadClients() {
    this.clientService.getAllClients('body').subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          this.clients = data;
        } else {
          this.clients = [];
        }
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }

  selectClient(cl: ClientDTO) {
    this.selectedClient = { ...cl };
    this.editMode = true;
  }

  updateClient() {
    if (!this.selectedClient?.id) return;
    this.clientService.createClient(this.selectedClient, 'body').subscribe({
      next: () => {
        this.selectedClient = null;
        this.editMode = false;
        this.loadClients();
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
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
