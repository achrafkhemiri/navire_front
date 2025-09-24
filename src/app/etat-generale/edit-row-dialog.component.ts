import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UserData } from './etat-generale.component';

@Component({
  selector: 'app-edit-row-dialog',
  templateUrl: './edit-row-dialog.component.html',
  styleUrls: ['./edit-row-dialog.component.css'],
  
})
export class EditRowDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<EditRowDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserData
  ) {}

  onNoClick(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.dialogRef.close(this.data);
  }
}
