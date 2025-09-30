import { Component } from '@angular/core';
import { DepotControllerService } from '../../api/api/depotController.service';
import { DepotDTO } from '../../api/model/depotDTO';

@Component({
  selector: 'app-depots',
  templateUrl: './depots.component.html',
  styleUrls: ['./depots.component.css']
})
export class DepotsComponent {
  depots: DepotDTO[] = [];
  filteredDepots: DepotDTO[] = [];
  selectedDepot: DepotDTO | null = null;
  dialogDepot: DepotDTO = { nom: '' };
  editMode: boolean = false;
  error: string = '';
  isSidebarOpen: boolean = true;
  showAddDialog: boolean = false;
  depotFilter: string = '';

  constructor(private depotService: DepotControllerService) {
    this.loadAllDepots();
  }

  loadAllDepots() {
    this.depotService.getAllDepots('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          console.log('getAllDepots - blob text:', text);
          try {
            const json = JSON.parse(text);
            console.log('getAllDepots - parsed json:', json);
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
          console.log('getAllDepots - json array, length:', data.length);
          this.depots = data;
        } else {
          console.log('getAllDepots - unexpected response:', data);
          this.depots = [];
        }
        this.filteredDepots = this.depots;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des dépôts';
        console.error(err);
        this.depots = [];
        this.filteredDepots = [];
      }
    });
  }

  filterDepots() {
    if (this.depotFilter.trim() === '') {
      this.filteredDepots = this.depots;
    } else {
      this.filteredDepots = this.depots.filter(depot =>
        depot.nom?.toLowerCase().includes(this.depotFilter.toLowerCase())
      );
    }
  }

  openAddDialog() {
    this.dialogDepot = { nom: '' };
    this.showAddDialog = true;
    this.editMode = false;
  }

  saveDepot() {
    if (this.dialogDepot.nom) {
      this.depotService.createDepot(this.dialogDepot).subscribe({
        next: () => {
          this.loadAllDepots();
          this.showAddDialog = false;
          this.dialogDepot = { nom: '' };
        },
        error: (err) => {
          this.error = 'Erreur lors de la création du dépôt';
          console.error(err);
        }
      });
    }
  }

  editDepot(depot: DepotDTO) {
    this.selectedDepot = { ...depot };
    this.dialogDepot = { ...depot };
    this.editMode = true;
    this.showAddDialog = true;
  }

  updateDepot() {
    if (this.selectedDepot && this.selectedDepot.id) {
      this.depotService.updateDepot(this.selectedDepot.id, this.selectedDepot).subscribe({
        next: () => {
          this.loadAllDepots();
          this.showAddDialog = false;
          this.selectedDepot = null;
          this.editMode = false;
        },
        error: (err) => {
          this.error = 'Erreur lors de la mise à jour du dépôt';
          console.error(err);
        }
      });
    }
  }

  deleteDepot(depot: DepotDTO) {
    if (depot.id && confirm('Êtes-vous sûr de vouloir supprimer ce dépôt ?')) {
      this.depotService.deleteDepot(depot.id).subscribe({
        next: () => {
          this.loadAllDepots();
        },
        error: (err) => {
          this.error = 'Erreur lors de la suppression du dépôt';
          console.error(err);
        }
      });
    }
  }

  cancel() {
    this.showAddDialog = false;
    this.selectedDepot = null;
    this.editMode = false;
  }
}