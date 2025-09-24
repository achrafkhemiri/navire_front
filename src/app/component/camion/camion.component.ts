import { Component } from '@angular/core';
import { CamionControllerService } from '../../api/api/camionController.service';
import { CamionDTO } from '../../api/model/camionDTO';

@Component({
  selector: 'app-camion',
  templateUrl: './camion.component.html',
  styleUrls: ['./camion.component.css']
})
export class CamionComponent {
  camions: CamionDTO[] = [];
  selectedCamion: CamionDTO | null = null;
  newCamion: CamionDTO = { matricule: '', societe: '', numBonLivraison: '' };
  editMode: boolean = false;
  error: string = '';

  constructor(private camionService: CamionControllerService) {
    this.loadCamions();
  }

  loadCamions() {
    this.camionService.getAllCamions('body').subscribe({
      next: async (data) => {
        // Si la réponse est un Blob, on la parse en JSON
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              this.camions = json;
            } else {
              this.camions = [];
            }
          } catch (e) {
            this.error = 'Erreur parsing JSON: ' + e;
            this.camions = [];
          }
        } else if (Array.isArray(data)) {
          this.camions = data;
        } else {
          this.camions = [];
        }
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }

  addCamion() {
    this.camionService.createCamion(this.newCamion, 'body').subscribe({
      next: () => {
        this.newCamion = { matricule: '', societe: '', numBonLivraison: '' };
        this.loadCamions(); // Recharge la liste après ajout
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  selectCamion(cam: CamionDTO) {
    this.selectedCamion = { ...cam };
    this.editMode = true;
  }

  updateCamion() {
    if (!this.selectedCamion?.id) return;
    this.camionService.createCamion(this.selectedCamion, 'body').subscribe({
      next: (updated) => {
        const idx = this.camions.findIndex(c => c.id === updated.id);
        if (idx > -1) this.camions[idx] = updated;
        this.selectedCamion = null;
        this.editMode = false;
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
  }

  deleteCamion(id?: number) {
    if (id === undefined) return;
    this.camionService.deleteCamion(id, 'body').subscribe({
      next: () => {
        this.camions = this.camions.filter(c => c.id !== id);
      },
      error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
    });
  }

  cancelEdit() {
    this.selectedCamion = null;
    this.editMode = false;
  }
}
