
import { Component, OnInit } from '@angular/core';
import { ProjetClientControllerService } from '../../api/api/projetClientController.service';
import { ProjetClientDTO } from '../../api/model/projetClientDTO';

@Component({
  selector: 'app-projet-client',
  templateUrl: './projet-client.component.html',
  styleUrls: ['./projet-client.component.css']
})
export class ProjetClientComponent implements OnInit {
  projetClients: ProjetClientDTO[] = [];
  selectedProjetClient: ProjetClientDTO | null = null;
  newProjetClient: ProjetClientDTO = {};
  editProjetClient: ProjetClientDTO | null = null;
  quantiteUpdate: number | null = null;

  constructor(public projetClientService: ProjetClientControllerService) {}

  ngOnInit() {
    this.loadProjetClients();
  }

  loadProjetClients() {
    // TODO: Replace with actual service call when available
    // Example: this.projetClientService.getAllProjetClients().subscribe(...)
    // For now, set to empty array
    this.projetClients = [];
  }

  addProjetClient() {
    // TODO: Replace with actual service call when available
    // Example: this.projetClientService.createProjetClient(this.newProjetClient).subscribe(...)
    // For now, just push to array
    const newClient = { ...this.newProjetClient, id: Date.now() };
    this.projetClients.push(newClient);
    this.newProjetClient = {};
  }

  editProjetClientStart(projetClient: ProjetClientDTO) {
    this.editProjetClient = { ...projetClient };
  }

  updateProjetClient() {
    // TODO: Replace with actual service call when available
    // Example: this.projetClientService.updateProjetClient(this.editProjetClient).subscribe(...)
    if (this.editProjetClient) {
      const idx = this.projetClients.findIndex(pc => pc.id === this.editProjetClient!.id);
      if (idx > -1) {
        this.projetClients[idx] = { ...this.editProjetClient };
      }
      this.editProjetClient = null;
    }
  }

  deleteProjetClient(id: number | undefined) {
    // TODO: Replace with actual service call when available
    // Example: this.projetClientService.deleteProjetClient(id).subscribe(...)
    this.projetClients = this.projetClients.filter(pc => pc.id !== id);
  }

  updateQuantiteAutorisee(id: number | undefined, quantite: number | null) {
    if (id && quantite !== null) {
      this.projetClientService.updateQuantiteAutorisee(id, quantite).subscribe(
        (updated: ProjetClientDTO) => {
          const idx = this.projetClients.findIndex(pc => pc.id === id);
          if (idx > -1) {
            this.projetClients[idx].quantiteAutorisee = updated.quantiteAutorisee;
          }
        }
      );
    }
  }
}
