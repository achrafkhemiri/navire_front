import { Component } from '@angular/core';
import { ClientControllerService } from '../../api/api/clientController.service';
import { ClientDTO } from '../../api/model/clientDTO';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.css']
})
export class ClientsComponent {
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

  constructor(
    private clientService: ClientControllerService
  ) {
    this.loadAllClients();
  }

  loadAllClients() {
    this.clientService.getAllClients('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          console.log('getAllClients - blob text:', text);
          try {
            const json = JSON.parse(text);
            console.log('getAllClients - parsed json:', json);
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
          console.log('getAllClients - json array, length:', data.length);
          this.clients = data;
        } else {
          console.log('getAllClients - unexpected response:', data);
          this.clients = [];
        }
        this.filteredClients = this.clients;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des clients';
        console.error(err);
        this.clients = [];
        this.filteredClients = [];
      }
    });
  }

  filterClients() {
    if (this.clientFilter.trim() === '') {
      this.filteredClients = this.clients;
    } else {
      this.filteredClients = this.clients.filter(client =>
        client.nom?.toLowerCase().includes(this.clientFilter.toLowerCase()) ||
        client.numero?.toLowerCase().includes(this.clientFilter.toLowerCase())
      );
    }
  }

  selectClient(client: ClientDTO) {
    this.selectedClient = client;
    this.editMode = false;
  }

  addClient() {
    this.dialogClient = { nom: '', numero: '' };
    this.showAddClient = true;
    this.editMode = false;
  }

  saveClient() {
    if (this.dialogClient.nom && this.dialogClient.numero) {
      this.clientService.createClient(this.dialogClient).subscribe({
        next: () => {
          this.loadAllClients();
          this.showAddClient = false;
          this.dialogClient = { nom: '', numero: '' };
        },
        error: (err) => {
          this.error = 'Erreur lors de la création du client';
          console.error(err);
        }
      });
    }
  }

  editClient(client: ClientDTO) {
    this.dialogClient = { ...client };
    this.editMode = true;
    this.showAddClient = true;
  }

  updateClient() {
    if (this.dialogClient.id) {
      this.clientService.updateClient(this.dialogClient.id, this.dialogClient).subscribe({
        next: () => {
          this.loadAllClients();
          this.showAddClient = false;
          this.editMode = false;
        },
        error: (err) => {
          this.error = 'Erreur lors de la mise à jour du client';
          console.error(err);
        }
      });
    }
  }

  deleteClient(client: ClientDTO) {
    if (client.id && confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      this.clientService.deleteClient(client.id).subscribe({
        next: () => {
          this.loadAllClients();
        },
        error: (err) => {
          this.error = 'Erreur lors de la suppression du client';
          console.error(err);
        }
      });
    }
  }

  cancel() {
    this.showAddClient = false;
    this.editMode = false;
  }
}