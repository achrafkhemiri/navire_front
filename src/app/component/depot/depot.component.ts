import { Component } from '@angular/core';
import { DepotControllerService } from '../../api/api/depotController.service';
import { DepotDTO } from '../../api/model/depotDTO';

@Component({
  selector: 'app-depot',
  templateUrl: './depot.component.html',
  styleUrls: ['./depot.component.css']
})
export class DepotComponent {
  depots: DepotDTO[] = [];
  selectedDepot: DepotDTO | null = null;
  newDepot: DepotDTO = { nom: '' };
  editMode: boolean = false;
  error: string = '';

  constructor(private depotService: DepotControllerService) {
    this.loadDepots();
  }
    selectDepot(dep: DepotDTO) {
      this.selectedDepot = { ...dep };
      this.editMode = true;
    }

    updateDepot() {
      if (!this.selectedDepot?.id) return;
      this.depotService.createDepot(this.selectedDepot, 'body').subscribe({
        next: () => {
          this.selectedDepot = null;
          this.editMode = false;
          this.loadDepots();
        },
        error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
      });
    }

    deleteDepot(id?: number) {
      if (id === undefined) return;
      this.depotService.deleteDepot(id, 'body').subscribe({
        next: () => {
          this.loadDepots();
        },
        error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
      });
    }

    cancelEdit() {
      this.selectedDepot = null;
      this.editMode = false;
    }

  addDepot() {
    this.depotService.createDepot(this.newDepot, 'body').subscribe({
      next: () => {
        this.newDepot = { nom: '' };
        this.loadDepots();
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }
  loadDepots() {
    this.depotService.getAllDepots('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              this.depots = json;
            } else {
              this.depots = [];
            }
          } catch (e) {
            this.error = 'Erreur parsing JSON: ' + e;
            this.depots = [];
          }
        } else if (Array.isArray(data)) {
          this.depots = data;
        } else {
          this.depots = [];
        }
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }
  }
