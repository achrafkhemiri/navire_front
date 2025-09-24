import { Component } from '@angular/core';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { VoyageDTO } from '../../api/model/voyageDTO';

@Component({
  selector: 'app-voyage',
  templateUrl: './voyage.component.html',
  styleUrls: ['./voyage.component.css']
})
export class VoyageComponent {
  voyages: VoyageDTO[] = [];
  selectedVoyage: VoyageDTO | null = null;
  newVoyage: VoyageDTO = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0 };
  editMode: boolean = false;
  error: string = '';

  constructor(private voyageService: VoyageControllerService) {
    this.loadVoyages();
  }

  loadVoyages() {
    this.voyageService.getAllVoyages('body').subscribe({
      next: (data) => this.voyages = data,
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }

  addVoyage() {
    this.voyageService.createVoyage(this.newVoyage, 'body').subscribe({
      next: (created) => {
        this.voyages.push(created);
        this.newVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0 };
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  selectVoyage(vg: VoyageDTO) {
    this.selectedVoyage = { ...vg };
    this.editMode = true;
  }

  updateVoyage() {
    if (!this.selectedVoyage?.id) return;
    this.voyageService.createVoyage(this.selectedVoyage, 'body').subscribe({
      next: (updated: VoyageDTO) => {
        const idx = this.voyages.findIndex((v: VoyageDTO) => v.id === updated.id);
        if (idx > -1) this.voyages[idx] = updated;
        this.selectedVoyage = null;
        this.editMode = false;
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
  }

  deleteVoyage(id?: number) {
    if (id === undefined) return;
    this.voyageService.deleteVoyage(id, 'body').subscribe({
      next: () => {
        this.voyages = this.voyages.filter(v => v.id !== id);
      },
      error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
    });
  }

  cancelEdit() {
    this.selectedVoyage = null;
    this.editMode = false;
  }
}
