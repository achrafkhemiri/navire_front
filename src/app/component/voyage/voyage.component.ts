import { Component } from '@angular/core';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { VoyageDTO } from '../../api/model/voyageDTO';
import { ChauffeurControllerService } from '../../api/api/chauffeurController.service';
import { CamionControllerService } from '../../api/api/camionController.service';
import { ClientControllerService } from '../../api/api/clientController.service';
import { DepotControllerService } from '../../api/api/depotController.service';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { ChauffeurDTO } from '../../api/model/chauffeurDTO';
import { CamionDTO } from '../../api/model/camionDTO';
import { ClientDTO } from '../../api/model/clientDTO';
import { DepotDTO } from '../../api/model/depotDTO';
import { ProjetDTO } from '../../api/model/projetDTO';

@Component({
  selector: 'app-voyage',
  templateUrl: './voyage.component.html',
  styleUrls: ['./voyage.component.css']
})
export class VoyageComponent {
  voyages: VoyageDTO[] = [];
  filteredVoyages: VoyageDTO[] = [];
  selectedVoyage: VoyageDTO | null = null;
  dialogVoyage: VoyageDTO & { _type?: 'client' | 'depot' } = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0, _type: undefined };
  editMode: boolean = false;
  error: string = '';
  chauffeurs: ChauffeurDTO[] = [];
  camions: CamionDTO[] = [];
  clients: ClientDTO[] = [];
  depots: DepotDTO[] = [];
  projets: ProjetDTO[] = [];
  isSidebarOpen: boolean = true;
  showAddDialog: boolean = false;
  voyageFilter: string = '';

  constructor(
    private voyageService: VoyageControllerService,
    private chauffeurService: ChauffeurControllerService,
    private camionService: CamionControllerService,
    private clientService: ClientControllerService,
    private depotService: DepotControllerService,
    private projetService: ProjetControllerService
  ) {
    this.loadVoyages();
    this.loadChauffeurs();
    this.loadCamions();
    this.loadClients();
    this.loadDepots();
    this.loadProjets();
  }

  loadChauffeurs() {
    this.chauffeurService.getAllChauffeurs('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.chauffeurs = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing chauffeurs: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.chauffeurs = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement chauffeurs: ' + (err.error?.message || err.message)
    });
  }

  loadCamions() {
    this.camionService.getAllCamions('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.camions = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing camions: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.camions = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement camions: ' + (err.error?.message || err.message)
    });
  }

  loadClients() {
    this.clientService.getAllClients('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.clients = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing clients: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.clients = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement clients: ' + (err.error?.message || err.message)
    });
  }

  loadDepots() {
    this.depotService.getAllDepots('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.depots = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing depots: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.depots = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement depots: ' + (err.error?.message || err.message)
    });
  }

  loadProjets() {
    this.projetService.getAllProjets('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.projets = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing projets: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.projets = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement projets: ' + (err.error?.message || err.message)
    });
  }



  openAddDialog() {
  this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0, _type: undefined };
    this.showAddDialog = true;
    this.editMode = false;
  }

  selectVoyage(vg: VoyageDTO) {
    this.dialogVoyage = { ...vg };
    this.selectedVoyage = vg;
    this.editMode = true;
    this.showAddDialog = false;
  }

  addDialogVoyage() {
    this.voyageService.createVoyage(this.dialogVoyage, 'body').subscribe({
      next: () => {
        this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0 };
        this.loadVoyages();
        this.closeDialog();
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  updateDialogVoyage() {
    if (!this.dialogVoyage?.id) return;
    const requiredFields = ['camionId', 'chauffeurId', 'clientId', 'depotId', 'projetId', 'userId'];
    for (const field of requiredFields) {
      if (this.dialogVoyage[field as keyof VoyageDTO] == null) {
        this.error = `Le champ ${field} est obligatoire.`;
        return;
      }
    }
    console.log(this.dialogVoyage);
    if (!this.dialogVoyage?.id) {
      this.error = "L'id du voyage à modifier est manquant.";
      return;
    }
    this.voyageService.updateVoyage(this.dialogVoyage.id, this.dialogVoyage, 'body').subscribe({
      next: () => {
        this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0 };
        this.selectedVoyage = null;
        this.editMode = false;
        this.loadVoyages();
        this.closeDialog();
      },
      error: (err) => {
        console.error('Erreur backend:', err);
        if (err.error instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            this.error = 'Erreur modification: ' + reader.result;
          };
          reader.readAsText(err.error);
        } else if (err.error) {
          this.error = 'Erreur modification: ' + err.error;
        } else {
          this.error = 'Erreur modification: ' + (err.message || '');
        }
      }
    });
  }

  closeDialog() {
    this.showAddDialog = false;
    this.editMode = false;
    this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0 };
    this.selectedVoyage = null;
    this.error = '';
  }

  applyFilter() {
    const filter = this.voyageFilter.trim().toLowerCase();
    if (!filter) {
      this.filteredVoyages = this.voyages;
    } else {
      this.filteredVoyages = this.voyages.filter(vg =>
        (vg.numBonLivraison?.toLowerCase().includes(filter) || false) ||
        (vg.numTicket?.toLowerCase().includes(filter) || false)
      );
    }
  }

  loadVoyages() {
    this.voyageService.getAllVoyages('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.voyages = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing: ' + e;
            }
            this.applyFilter();
          };
          reader.readAsText(data);
        } else {
          this.voyages = data;
          this.applyFilter();
        }
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }

  deleteVoyage(id?: number) {
    if (id === undefined) return;
    this.voyageService.deleteVoyage(id, 'body').subscribe({
      next: () => {
        this.loadVoyages();
      },
      error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
    });
  }
}
